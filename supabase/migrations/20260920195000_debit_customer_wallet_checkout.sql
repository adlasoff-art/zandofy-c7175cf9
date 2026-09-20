-- Purpose: Allow customers to apply wallet balance on online-paid checkouts (not COD/off_platform).
-- Tables: orders, customer_wallets, customer_wallet_transactions
-- Risk: Additive column + SECURITY DEFINER RPC. Idempotent on order_id debit.
-- Rollback: DROP FUNCTION debit_customer_wallet_for_order; ALTER TABLE orders DROP COLUMN wallet_credit_applied;
-- Staging → production: mandatory smoke with test wallet credit before prod.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wallet_credit_applied numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.wallet_credit_applied IS
  'Amount of customer wallet debit applied to this order (online payment methods only).';

CREATE OR REPLACE FUNCTION public.debit_customer_wallet_for_order(
  p_order_id uuid,
  p_amount numeric,
  p_user_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_apply numeric;
  v_online text[] := ARRAY['mobile_money', 'stripe', 'card', 'paypal'];
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'WALLET_DEBIT_INVALID_AMOUNT';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_DEBIT_ORDER_NOT_FOUND';
  END IF;

  IF v_order.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'WALLET_DEBIT_FORBIDDEN';
  END IF;

  -- Idempotent: already applied
  IF COALESCE(v_order.wallet_credit_applied, 0) > 0 THEN
    RETURN v_order.wallet_credit_applied;
  END IF;

  IF v_order.payment_method IS NULL OR NOT (v_order.payment_method = ANY (v_online)) THEN
    RAISE EXCEPTION 'WALLET_DEBIT_ONLINE_ONLY';
  END IF;

  -- Existing debit row for this order?
  IF EXISTS (
    SELECT 1 FROM public.customer_wallet_transactions t
    WHERE t.order_id = p_order_id AND t.type = 'debit_purchase'
  ) THEN
    SELECT COALESCE(wallet_credit_applied, 0) INTO v_apply FROM public.orders WHERE id = p_order_id;
    RETURN v_apply;
  END IF;

  SELECT * INTO v_wallet FROM public.customer_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_DEBIT_NO_WALLET';
  END IF;

  v_apply := LEAST(p_amount, COALESCE(v_wallet.balance, 0), COALESCE(v_order.total, 0));
  IF v_apply <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.customer_wallets
  SET balance = balance - v_apply,
      updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.customer_wallet_transactions
    (wallet_id, user_id, amount, type, order_id, description)
  VALUES
    (v_wallet.id, p_user_id, -v_apply, 'debit_purchase', p_order_id,
     'Paiement commande ' || COALESCE(v_order.order_ref, p_order_id::text));

  UPDATE public.orders
  SET wallet_credit_applied = v_apply
  WHERE id = p_order_id;

  RETURN v_apply;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debit_customer_wallet_for_order(uuid, numeric, uuid) TO authenticated, service_role;
