-- Admin-initiated store transfer: immediate execution (single admin click)

CREATE OR REPLACE FUNCTION public.validate_store_transfer_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.transfer_type, 'owner_initiated') = 'admin_initiated' THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    ) THEN
      RAISE EXCEPTION 'Forbidden: admin or manager role required';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.stores
      WHERE id = NEW.store_id AND owner_id = NEW.from_user_id
    ) THEN
      RAISE EXCEPTION 'from_user_id must be the current store owner';
    END IF;
  ELSE
    IF NEW.from_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the current owner can initiate a transfer';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.stores
      WHERE id = NEW.store_id AND owner_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'You do not own this store';
    END IF;
  END IF;

  IF NEW.to_user_id = NEW.from_user_id THEN
    RAISE EXCEPTION 'Cannot transfer to yourself';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.store_transfer_requests
    WHERE store_id = NEW.store_id
      AND status IN ('pending', 'under_review')
  ) THEN
    RAISE EXCEPTION 'A transfer request is already pending for this store';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_execute_store_transfer(
  p_store_id uuid,
  p_to_user_id uuid,
  p_reason text,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_from_user_id uuid;
  v_store_name text;
  v_request_id uuid;
  v_result jsonb;
  v_recipient_store_count int;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(v_admin_id, 'admin')
    OR public.has_role(v_admin_id, 'manager')
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin or manager role required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason of at least 3 characters is required';
  END IF;

  SELECT owner_id, name
  INTO v_from_user_id, v_store_name
  FROM public.stores
  WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  IF v_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'Cannot transfer to the current owner';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_to_user_id) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.store_transfer_requests
    WHERE store_id = p_store_id
      AND status IN ('pending', 'under_review')
  ) THEN
    RAISE EXCEPTION 'A transfer request is already pending for this store';
  END IF;

  SELECT count(*)::int
  INTO v_recipient_store_count
  FROM public.stores
  WHERE owner_id = p_to_user_id;

  INSERT INTO public.store_transfer_requests (
    store_id,
    from_user_id,
    to_user_id,
    transfer_type,
    reason,
    status,
    kyc_verified_from,
    kyc_verified_to,
    reviewed_by,
    reviewed_at,
    admin_notes
  ) VALUES (
    p_store_id,
    v_from_user_id,
    p_to_user_id,
    'admin_initiated',
    trim(p_reason),
    'pending',
    true,
    true,
    v_admin_id,
    now(),
    p_admin_notes
  )
  RETURNING id INTO v_request_id;

  v_result := public.complete_store_transfer(
    v_request_id,
    v_admin_id,
    COALESCE(p_admin_notes, trim(p_reason))
  );

  RETURN v_result || jsonb_build_object(
    'request_id', v_request_id,
    'recipient_store_count_before', v_recipient_store_count,
    'recipient_store_count_after', v_recipient_store_count + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_execute_store_transfer(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_execute_store_transfer(uuid, uuid, text, text) TO authenticated;
