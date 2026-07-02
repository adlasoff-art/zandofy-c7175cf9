-- Store transfer: validate insert, fix status transitions, atomic completion RPC

-- Allow pending -> completed (admin direct approve)
CREATE OR REPLACE FUNCTION public.validate_store_transfer()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'under_review', 'completed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transfer status: %', NEW.status;
  END IF;
  IF NEW.status = 'completed' AND OLD.status NOT IN ('under_review', 'pending') THEN
    RAISE EXCEPTION 'Cannot complete transfer from status %', OLD.status;
  END IF;
  IF NEW.status = 'completed' AND OLD.status IN ('under_review', 'pending') THEN
    NEW.cooldown_until := now() + interval '72 hours';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Vendor may only initiate transfer for a store they own (no duplicate pending request)
CREATE OR REPLACE FUNCTION public.validate_store_transfer_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.from_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the current owner can initiate a transfer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = NEW.store_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You do not own this store';
  END IF;

  IF NEW.to_user_id = auth.uid() THEN
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

DROP TRIGGER IF EXISTS trg_validate_store_transfer_insert ON public.store_transfer_requests;
CREATE TRIGGER trg_validate_store_transfer_insert
  BEFORE INSERT ON public.store_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_store_transfer_insert();

-- Atomic approval: transfer ownership + vendor roles
CREATE OR REPLACE FUNCTION public.complete_store_transfer(
  p_request_id uuid,
  p_admin_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.store_transfer_requests%ROWTYPE;
  v_store_name text;
  v_vendor_role_removed boolean := false;
BEGIN
  IF NOT (
    public.has_role(p_admin_id, 'admin')
    OR public.has_role(p_admin_id, 'manager')
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin or manager role required';
  END IF;

  SELECT * INTO v_req
  FROM public.store_transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer request not found';
  END IF;

  IF v_req.status NOT IN ('pending', 'under_review') THEN
    RAISE EXCEPTION 'Request cannot be completed from status %', v_req.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = v_req.store_id AND owner_id = v_req.from_user_id
  ) THEN
    RAISE EXCEPTION 'Store owner mismatch';
  END IF;

  IF v_req.to_user_id = v_req.from_user_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_req.to_user_id) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  SELECT name INTO v_store_name FROM public.stores WHERE id = v_req.store_id;

  UPDATE public.stores
  SET
    owner_id = v_req.to_user_id,
    can_create_coupons = false,
    collaborators_enabled = false,
    whatsapp_number = null
  WHERE id = v_req.store_id;

  UPDATE public.vendor_wallets
  SET retention_days = 30
  WHERE store_id = v_req.store_id;

  INSERT INTO public.user_roles (user_id, role)
  SELECT v_req.to_user_id, 'vendor'::public.app_role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_req.to_user_id AND role = 'vendor'::public.app_role
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE owner_id = v_req.from_user_id AND id <> v_req.store_id
  ) THEN
    DELETE FROM public.user_roles
    WHERE user_id = v_req.from_user_id AND role = 'vendor'::public.app_role;
    v_vendor_role_removed := true;
  END IF;

  UPDATE public.store_transfer_requests
  SET
    status = 'completed',
    reviewed_by = p_admin_id,
    reviewed_at = now(),
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'from_user_id', v_req.from_user_id,
    'to_user_id', v_req.to_user_id,
    'store_id', v_req.store_id,
    'store_name', v_store_name,
    'vendor_role_removed', v_vendor_role_removed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_store_transfer(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_store_transfer(uuid, uuid, text) TO authenticated;
