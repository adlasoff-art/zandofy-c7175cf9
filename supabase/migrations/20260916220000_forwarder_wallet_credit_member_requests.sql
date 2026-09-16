-- Purpose: Auto-credit forwarder wallet on platform-collected freight + member request KYC flow.
-- Depends on: 20260916213000_forwarder_members_wallet (wallets table).
-- Risk: Additive; credits only when shipping_payment_status→paid and handoff exists; idempotent ledger.

-- ---------------------------------------------------------------------------
-- 1) Ledger + idempotent credit function
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forwarder_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id uuid NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal', 'adjustment')),
  amount numeric NOT NULL CHECK (amount > 0),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  handoff_id uuid REFERENCES public.forwarder_handoffs(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fwd_wallet_tx_order_credit
  ON public.forwarder_wallet_transactions (forwarder_id, order_id)
  WHERE type = 'credit' AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fwd_wallet_tx_fw
  ON public.forwarder_wallet_transactions (forwarder_id, created_at DESC);

ALTER TABLE public.forwarder_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fwd_wallet_tx_select_finance" ON public.forwarder_wallet_transactions;
CREATE POLICY "fwd_wallet_tx_select_finance"
  ON public.forwarder_wallet_transactions FOR SELECT TO authenticated
  USING (public.user_is_forwarder_finance(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "fwd_wallet_tx_admin" ON public.forwarder_wallet_transactions;
CREATE POLICY "fwd_wallet_tx_admin"
  ON public.forwarder_wallet_transactions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  );

CREATE OR REPLACE FUNCTION public.credit_forwarder_wallet_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handoff public.forwarder_handoffs%ROWTYPE;
  v_amount numeric;
  v_currency text;
  v_order_ref text;
  v_paid text;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_order');
  END IF;

  SELECT o.shipping_payment_status, o.order_ref, o.shipping_cost
    INTO v_paid, v_order_ref, v_amount
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  -- Only when freight was collected on the platform
  IF COALESCE(v_paid, '') <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shipping_not_paid');
  END IF;

  SELECT * INTO v_handoff
  FROM public.forwarder_handoffs h
  WHERE h.order_id = p_order_id
    AND h.status IS DISTINCT FROM 'cancelled'
  ORDER BY h.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_handoff');
  END IF;

  -- Prefer freight quote amount
  v_currency := 'USD';
  IF v_handoff.freight_quote_id IS NOT NULL THEN
    SELECT COALESCE(fq.quoted_price, 0), COALESCE(fq.currency, 'USD')
      INTO v_amount, v_currency
    FROM public.freight_quotes fq
    WHERE fq.id = v_handoff.freight_quote_id;
  END IF;

  IF COALESCE(v_amount, 0) <= 0 THEN
    SELECT COALESCE(shipping_cost, 0) INTO v_amount FROM public.orders WHERE id = p_order_id;
  END IF;

  IF COALESCE(v_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'zero_amount');
  END IF;

  -- Idempotent: unique index on (forwarder_id, order_id) credit
  IF EXISTS (
    SELECT 1 FROM public.forwarder_wallet_transactions t
    WHERE t.forwarder_id = v_handoff.forwarder_id
      AND t.order_id = p_order_id
      AND t.type = 'credit'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_credited');
  END IF;

  INSERT INTO public.forwarder_wallets (forwarder_id, available_balance, total_earned, currency)
  VALUES (v_handoff.forwarder_id, v_amount, v_amount, COALESCE(v_currency, 'USD'))
  ON CONFLICT (forwarder_id) DO UPDATE
  SET available_balance = public.forwarder_wallets.available_balance + EXCLUDED.available_balance,
      total_earned = public.forwarder_wallets.total_earned + EXCLUDED.total_earned,
      updated_at = now();

  INSERT INTO public.forwarder_wallet_transactions (
    forwarder_id, type, amount, order_id, handoff_id, description
  ) VALUES (
    v_handoff.forwarder_id,
    'credit',
    v_amount,
    p_order_id,
    v_handoff.id,
    'Fret plateforme ' || COALESCE(v_order_ref, p_order_id::text)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'forwarder_id', v_handoff.forwarder_id,
    'amount', v_amount,
    'currency', COALESCE(v_currency, 'USD')
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_credited');
END;
$$;

REVOKE ALL ON FUNCTION public.credit_forwarder_wallet_for_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_forwarder_wallet_for_order(uuid) TO service_role;

-- Trigger: shipping paid on order
CREATE OR REPLACE FUNCTION public.trg_credit_forwarder_on_shipping_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shipping_payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.shipping_payment_status IS DISTINCT FROM 'paid') THEN
    PERFORM public.credit_forwarder_wallet_for_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_forwarder_on_shipping_paid ON public.orders;
CREATE TRIGGER trg_credit_forwarder_on_shipping_paid
  AFTER INSERT OR UPDATE OF shipping_payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_credit_forwarder_on_shipping_paid();

-- Trigger: handoff created while shipping already paid
CREATE OR REPLACE FUNCTION public.trg_credit_forwarder_on_handoff_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.credit_forwarder_wallet_for_order(NEW.order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_forwarder_on_handoff_insert ON public.forwarder_handoffs;
CREATE TRIGGER trg_credit_forwarder_on_handoff_insert
  AFTER INSERT ON public.forwarder_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_credit_forwarder_on_handoff_insert();

-- ---------------------------------------------------------------------------
-- 2) Member requests (KYC by forwarder → admin approve → account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forwarder_member_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id uuid NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  job_title text,
  role text NOT NULL DEFAULT 'ops'
    CHECK (role IN ('ops', 'finance')),
  id_document_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.forwarder_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fwd_member_req_status
  ON public.forwarder_member_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fwd_member_req_fw
  ON public.forwarder_member_requests (forwarder_id, created_at DESC);

ALTER TABLE public.forwarder_member_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fwd_member_req_select_owner" ON public.forwarder_member_requests;
CREATE POLICY "fwd_member_req_select_owner"
  ON public.forwarder_member_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id AND f.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fwd_member_req_insert_owner" ON public.forwarder_member_requests;
CREATE POLICY "fwd_member_req_insert_owner"
  ON public.forwarder_member_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id
        AND f.owner_user_id = auth.uid()
        AND f.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "fwd_member_req_update_owner_cancel" ON public.forwarder_member_requests;
CREATE POLICY "fwd_member_req_update_owner_cancel"
  ON public.forwarder_member_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id AND f.owner_user_id = auth.uid()
    )
    AND status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id AND f.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fwd_member_req_admin" ON public.forwarder_member_requests;
CREATE POLICY "fwd_member_req_admin"
  ON public.forwarder_member_requests FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  );

-- ID docs bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forwarder-member-ids',
  'forwarder-member-ids',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "fwd_member_ids_owner_rw" ON storage.objects;
CREATE POLICY "fwd_member_ids_owner_rw"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'forwarder-member-ids'
    AND (
      EXISTS (
        SELECT 1 FROM public.forwarders f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
      )
    )
  )
  WITH CHECK (
    bucket_id = 'forwarder-member-ids'
    AND (
      EXISTS (
        SELECT 1 FROM public.forwarders f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Team seats config in forwarder_saas
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'forwarder_saas',
  jsonb_build_object(
    'team_seats', jsonb_build_object(
      'mode', 'free',
      'included_seats', 3,
      'price_usd_per_seat_monthly', 9,
      'notes', 'Admin peut basculer free/paid. Au-delà de included_seats, demande flaggée payante.'
    )
  ),
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.platform_settings.value, '{}'::jsonb)
  || jsonb_build_object(
       'team_seats',
       COALESCE(public.platform_settings.value->'team_seats', '{}'::jsonb)
         || COALESCE(EXCLUDED.value->'team_seats', '{}'::jsonb)
     ),
    updated_at = now();

COMMENT ON TABLE public.forwarder_member_requests IS
  'Forwarder submits staff (name, ID doc) → admin validates → auth user + forwarder_members created.';
COMMENT ON FUNCTION public.credit_forwarder_wallet_for_order(uuid) IS
  'Credits forwarder wallet when order freight is paid on platform and a handoff exists; idempotent.';
