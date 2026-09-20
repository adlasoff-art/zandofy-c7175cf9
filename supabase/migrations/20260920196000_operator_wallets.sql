-- Purpose: Operator (delivery_operators) wallets + withdrawals, seeded on approve.
-- Tables: operator_wallets, operator_wallet_transactions, operator_withdrawal_requests
-- Risk: New tables + RLS + seed trigger. No auto credit of commissions (manual/admin later).
-- Rollback: DROP TRIGGER ...; DROP TABLE operator_withdrawal_requests, operator_wallet_transactions, operator_wallets;
-- Staging → production: approve operator → wallet row; owner can request withdrawal.

CREATE TABLE IF NOT EXISTS public.operator_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL UNIQUE REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  min_withdrawal numeric NOT NULL DEFAULT 50,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operator_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.operator_wallets(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  type text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_wallet_tx_op_created
  ON public.operator_wallet_transactions (operator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.operator_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'mobile_money',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  payout_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.operator_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_owns_delivery_operator(p_operator_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_operators o
    WHERE o.id = p_operator_id AND o.owner_user_id = p_uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_owns_delivery_operator(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "operator_wallets_owner_select" ON public.operator_wallets;
CREATE POLICY "operator_wallets_owner_select"
  ON public.operator_wallets FOR SELECT TO authenticated
  USING (public.user_owns_delivery_operator(operator_id, auth.uid()));

DROP POLICY IF EXISTS "operator_wallets_admin" ON public.operator_wallets;
CREATE POLICY "operator_wallets_admin"
  ON public.operator_wallets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

DROP POLICY IF EXISTS "operator_wallet_tx_owner_select" ON public.operator_wallet_transactions;
CREATE POLICY "operator_wallet_tx_owner_select"
  ON public.operator_wallet_transactions FOR SELECT TO authenticated
  USING (public.user_owns_delivery_operator(operator_id, auth.uid()));

DROP POLICY IF EXISTS "operator_wallet_tx_admin" ON public.operator_wallet_transactions;
CREATE POLICY "operator_wallet_tx_admin"
  ON public.operator_wallet_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

DROP POLICY IF EXISTS "operator_withdrawals_owner_select" ON public.operator_withdrawal_requests;
CREATE POLICY "operator_withdrawals_owner_select"
  ON public.operator_withdrawal_requests FOR SELECT TO authenticated
  USING (public.user_owns_delivery_operator(operator_id, auth.uid()));

DROP POLICY IF EXISTS "operator_withdrawals_owner_insert" ON public.operator_withdrawal_requests;
CREATE POLICY "operator_withdrawals_owner_insert"
  ON public.operator_withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_delivery_operator(operator_id, auth.uid()));

DROP POLICY IF EXISTS "operator_withdrawals_admin" ON public.operator_withdrawal_requests;
CREATE POLICY "operator_withdrawals_admin"
  ON public.operator_withdrawal_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE OR REPLACE FUNCTION public.ensure_operator_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.operator_wallets (operator_id)
    VALUES (NEW.id)
    ON CONFLICT (operator_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_operator_wallet ON public.delivery_operators;
CREATE TRIGGER trg_ensure_operator_wallet
  AFTER INSERT OR UPDATE OF status ON public.delivery_operators
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_operator_wallet();

-- Backfill approved operators
INSERT INTO public.operator_wallets (operator_id)
SELECT o.id FROM public.delivery_operators o
WHERE o.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM public.operator_wallets w WHERE w.operator_id = o.id)
ON CONFLICT (operator_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.request_operator_withdrawal(
  p_operator_id uuid,
  p_amount numeric,
  p_method text DEFAULT 'mobile_money',
  p_payout_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.operator_wallets%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_owns_delivery_operator(p_operator_id, auth.uid()) THEN
    IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)) THEN
      RAISE EXCEPTION 'OPERATOR_WITHDRAWAL_FORBIDDEN';
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM public.operator_wallets WHERE operator_id = p_operator_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_WALLET_MISSING';
  END IF;
  IF p_amount < v_wallet.min_withdrawal THEN
    RAISE EXCEPTION 'OPERATOR_WITHDRAWAL_BELOW_MIN';
  END IF;
  IF p_amount > v_wallet.available_balance THEN
    RAISE EXCEPTION 'OPERATOR_WITHDRAWAL_INSUFFICIENT';
  END IF;

  INSERT INTO public.operator_withdrawal_requests (operator_id, amount, method, payout_details)
  VALUES (p_operator_id, p_amount, COALESCE(NULLIF(p_method, ''), 'mobile_money'), COALESCE(p_payout_details, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_operator_withdrawal(uuid, numeric, text, jsonb) TO authenticated, service_role;
