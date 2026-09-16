-- Purpose: Audit harden — member-request RLS (no self-approve), atomic withdrawal debit,
--          safer wallet credit insert order, unique pending request per email.
-- Risk: Additive / policy replace only. ~4000+ users: no destructive DDL.

-- ---------------------------------------------------------------------------
-- 1) Member requests: owner may ONLY cancel (not approve/reject)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "fwd_member_req_update_owner_cancel" ON public.forwarder_member_requests;
CREATE POLICY "fwd_member_req_update_owner_cancel"
  ON public.forwarder_member_requests FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id AND f.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id AND f.owner_user_id = auth.uid()
    )
  );

-- One open pending request per forwarder+email
CREATE UNIQUE INDEX IF NOT EXISTS idx_fwd_member_req_pending_email
  ON public.forwarder_member_requests (forwarder_id, lower(email))
  WHERE status = 'pending';

ALTER TABLE public.forwarder_members
  ADD COLUMN IF NOT EXISTS password_managed_by_owner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.forwarder_members.password_managed_by_owner IS
  'True only when auth user was created by admin-approve-forwarder-member; owner may set password.';

CREATE OR REPLACE FUNCTION public.request_forwarder_withdrawal(
  p_forwarder_id uuid,
  p_amount numeric,
  p_method text,
  p_payout_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.forwarder_wallets%ROWTYPE;
  v_id uuid;
  v_method text;
BEGIN
  IF NOT public.user_is_forwarder_finance(p_forwarder_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  v_method := COALESCE(NULLIF(trim(p_method), ''), 'mobile_money');

  SELECT * INTO v_wallet
  FROM public.forwarder_wallets
  WHERE forwarder_id = p_forwarder_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;

  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  IF p_amount < COALESCE(v_wallet.min_withdrawal, 0) THEN
    RAISE EXCEPTION 'below_minimum';
  END IF;

  UPDATE public.forwarder_wallets
  SET available_balance = available_balance - p_amount,
      updated_at = now()
  WHERE forwarder_id = p_forwarder_id;

  INSERT INTO public.forwarder_withdrawal_requests (
    forwarder_id, amount, method, status, payout_details
  ) VALUES (
    p_forwarder_id, p_amount, v_method, 'pending', COALESCE(p_payout_details, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.forwarder_wallet_transactions (
    forwarder_id, type, amount, description
  ) VALUES (
    p_forwarder_id, 'withdrawal', p_amount, 'Demande de retrait ' || v_id::text
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_forwarder_withdrawal(uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_forwarder_withdrawal(uuid, numeric, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Safer credit: insert ledger first (unique), then bump wallet
-- ---------------------------------------------------------------------------
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
  v_inserted boolean := false;
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

  IF COALESCE(v_paid, '') <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shipping_not_paid');
  END IF;

  -- Require positive freight (avoid crediting $0 local defaults)
  IF COALESCE(v_amount, 0) <= 0 THEN
    -- still try quote below
    NULL;
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

  -- Ensure wallet row exists
  INSERT INTO public.forwarder_wallets (forwarder_id, currency)
  VALUES (v_handoff.forwarder_id, COALESCE(v_currency, 'USD'))
  ON CONFLICT (forwarder_id) DO NOTHING;

  -- Ledger first (idempotent unique index)
  BEGIN
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
    v_inserted := true;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', true, 'reason', 'already_credited');
  END;

  IF v_inserted THEN
    UPDATE public.forwarder_wallets
    SET available_balance = available_balance + v_amount,
        total_earned = total_earned + v_amount,
        updated_at = now()
    WHERE forwarder_id = v_handoff.forwarder_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'forwarder_id', v_handoff.forwarder_id,
    'amount', v_amount,
    'currency', COALESCE(v_currency, 'USD')
  );
END;
$$;
