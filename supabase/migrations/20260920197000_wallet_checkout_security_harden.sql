-- Purpose: Harden wallet debit/refund + operator withdrawal hold; lock price on awaiting_payment.
-- Tables: orders, customer_wallets, customer_wallet_transactions, operator_wallets, operator_withdrawal_requests, products
-- Risk: Replaces SECURITY DEFINER RPCs (compatible signatures). Additive refund RPC + unique index.
-- Rollback: restore prior function bodies from 20260920195000 / 20260920196000 / 20260920190000.
-- Staging → production: smoke wallet checkout (partial + full cover + fail path) then prod.

-- ---------------------------------------------------------------------------
-- 1) Price lock also while MoMo/KelPay unpaid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_has_active_orders(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = p_product_id
      AND o.status IN (
        'awaiting_payment',
        'pending',
        'confirmed',
        'preparing',
        'in_shipping',
        'shipped',
        'assigning_rider',
        'rider_assigned',
        'out_for_delivery',
        'ready_for_pickup'
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) Debit RPC: bind to auth.uid(), awaiting_payment only
-- ---------------------------------------------------------------------------
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
  v_uid uuid := auth.uid();
  v_online text[] := ARRAY['mobile_money', 'stripe', 'card', 'paypal'];
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'WALLET_DEBIT_INVALID_AMOUNT';
  END IF;

  -- Caller must be the buyer (service_role has auth.uid() null — allow for edge only)
  IF v_uid IS NOT NULL THEN
    IF p_user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'WALLET_DEBIT_FORBIDDEN';
    END IF;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_DEBIT_ORDER_NOT_FOUND';
  END IF;

  IF v_order.user_id IS DISTINCT FROM COALESCE(v_uid, p_user_id) THEN
    RAISE EXCEPTION 'WALLET_DEBIT_FORBIDDEN';
  END IF;

  IF v_order.status IS DISTINCT FROM 'awaiting_payment' THEN
    RAISE EXCEPTION 'WALLET_DEBIT_ORDER_NOT_AWAITING';
  END IF;

  IF COALESCE(v_order.wallet_credit_applied, 0) > 0 THEN
    RETURN v_order.wallet_credit_applied;
  END IF;

  IF v_order.payment_method IS NULL OR NOT (v_order.payment_method = ANY (v_online)) THEN
    RAISE EXCEPTION 'WALLET_DEBIT_ONLINE_ONLY';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_wallet_transactions t
    WHERE t.order_id = p_order_id AND t.type = 'debit_purchase'
  ) THEN
    RETURN COALESCE(v_order.wallet_credit_applied, 0);
  END IF;

  SELECT * INTO v_wallet
  FROM public.customer_wallets
  WHERE user_id = v_order.user_id
  FOR UPDATE;
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
    (v_wallet.id, v_order.user_id, -v_apply, 'debit_purchase', p_order_id,
     'Paiement commande ' || COALESCE(v_order.order_ref, p_order_id::text));

  UPDATE public.orders
  SET wallet_credit_applied = v_apply
  WHERE id = p_order_id;

  RETURN v_apply;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_wallet_tx_debit_order_unique
  ON public.customer_wallet_transactions (order_id)
  WHERE type = 'debit_purchase' AND order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Refund wallet credit when payment fails / cancelled
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_customer_wallet_for_order(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_wallet public.customer_wallets%ROWTYPE;
  v_credit numeric;
  v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_credit := COALESCE(v_order.wallet_credit_applied, 0);
  IF v_credit <= 0 THEN
    RETURN 0;
  END IF;

  -- Owner or service_role (uid null) or staff
  IF v_uid IS NOT NULL
     AND v_order.user_id IS DISTINCT FROM v_uid
     AND NOT (public.has_role(v_uid, 'admin'::public.app_role) OR public.has_role(v_uid, 'manager'::public.app_role)) THEN
    RAISE EXCEPTION 'WALLET_REFUND_FORBIDDEN';
  END IF;

  -- Already refunded?
  IF EXISTS (
    SELECT 1 FROM public.customer_wallet_transactions t
    WHERE t.order_id = p_order_id
      AND t.type = 'credit_refund'
      AND t.description LIKE 'Remboursement portefeuille commande%'
  ) THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_wallet
  FROM public.customer_wallets
  WHERE user_id = v_order.user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.customer_wallets (user_id, balance, currency)
    VALUES (v_order.user_id, v_credit, 'USD')
    RETURNING * INTO v_wallet;
  ELSE
    UPDATE public.customer_wallets
    SET balance = balance + v_credit,
        updated_at = now()
    WHERE id = v_wallet.id;
  END IF;

  INSERT INTO public.customer_wallet_transactions
    (wallet_id, user_id, amount, type, order_id, description)
  VALUES
    (v_wallet.id, v_order.user_id, v_credit, 'credit_refund', p_order_id,
     'Remboursement portefeuille commande ' || COALESCE(v_order.order_ref, p_order_id::text));

  UPDATE public.orders
  SET wallet_credit_applied = 0
  WHERE id = p_order_id;

  RETURN v_credit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_customer_wallet_for_order(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Operator withdrawal: hold funds + RPC-only insert
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "operator_withdrawals_owner_insert" ON public.operator_withdrawal_requests;

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
  v_method text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_owns_delivery_operator(p_operator_id, auth.uid()) THEN
    IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)) THEN
      RAISE EXCEPTION 'OPERATOR_WITHDRAWAL_FORBIDDEN';
    END IF;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'OPERATOR_WITHDRAWAL_INVALID_AMOUNT';
  END IF;

  v_method := COALESCE(NULLIF(trim(p_method), ''), 'mobile_money');

  SELECT * INTO v_wallet
  FROM public.operator_wallets
  WHERE operator_id = p_operator_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_WALLET_MISSING';
  END IF;
  IF p_amount < COALESCE(v_wallet.min_withdrawal, 0) THEN
    RAISE EXCEPTION 'OPERATOR_WITHDRAWAL_BELOW_MIN';
  END IF;
  IF p_amount > v_wallet.available_balance THEN
    RAISE EXCEPTION 'OPERATOR_WITHDRAWAL_INSUFFICIENT';
  END IF;

  UPDATE public.operator_wallets
  SET available_balance = available_balance - p_amount,
      pending_balance = pending_balance + p_amount,
      updated_at = now()
  WHERE operator_id = p_operator_id;

  INSERT INTO public.operator_withdrawal_requests (operator_id, amount, method, payout_details)
  VALUES (p_operator_id, p_amount, v_method, COALESCE(p_payout_details, '{}'::jsonb))
  RETURNING id INTO v_id;

  INSERT INTO public.operator_wallet_transactions
    (operator_id, wallet_id, amount, type, description)
  VALUES
    (p_operator_id, v_wallet.id, -p_amount, 'withdrawal_hold',
     'Demande de retrait ' || v_id::text);

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Also lock discount / is_sale while active (incl. awaiting_payment)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_product_price_change_with_active_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'manager'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.price IS DISTINCT FROM OLD.price
     OR NEW.original_price IS DISTINCT FROM OLD.original_price
     OR NEW.discount IS DISTINCT FROM OLD.discount
     OR NEW.is_sale IS DISTINCT FROM OLD.is_sale THEN
    IF public.product_has_active_orders(NEW.id) THEN
      RAISE EXCEPTION 'PRODUCT_PRICE_LOCKED: Prix verrouillé tant qu''une commande est en cours pour ce produit.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_product_price_change_with_active_orders ON public.products;
CREATE TRIGGER trg_prevent_product_price_change_with_active_orders
  BEFORE UPDATE OF price, original_price, discount, is_sale ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_product_price_change_with_active_orders();
