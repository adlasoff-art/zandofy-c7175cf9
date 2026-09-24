-- Purpose: 1 payment session → N store orders; vendor opt-in group checkout.
-- Tables: stores (group_checkout_policy), checkout_sessions (new),
--          orders.checkout_session_id, payment_transactions.checkout_session_id
-- RPCs: get_checkout_group_compat, confirm_checkout_session_payment,
--       fail_checkout_session_payment, vendor_update_group_checkout_policy
-- Rollback: stop using sessions in app; columns nullable/default solo_only safe.
-- Risk (~4000+ users): low — defaults solo_only; nullable FKs; mono-store unchanged.

-- ---------------------------------------------------------------------------
-- 1) Vendor opt-in policy (default = current mono-store behaviour)
-- ---------------------------------------------------------------------------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS group_checkout_policy text NOT NULL DEFAULT 'solo_only';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stores_group_checkout_policy_check'
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_group_checkout_policy_check
      CHECK (group_checkout_policy IN ('solo_only', 'own_stores_only', 'multi_vendor_ok'));
  END IF;
END $$;

COMMENT ON COLUMN public.stores.group_checkout_policy IS
  'solo_only (default) | own_stores_only | multi_vendor_ok — who may share one checkout_session.';

-- ---------------------------------------------------------------------------
-- 2) checkout_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  payment_method text,
  currency text NOT NULL DEFAULT 'USD',
  anchor_order_id uuid,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  wallet_credit_applied numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  expires_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'checkout_sessions_status_check'
  ) THEN
    ALTER TABLE public.checkout_sessions
      ADD CONSTRAINT checkout_sessions_status_check
      CHECK (status IN ('open', 'payment_pending', 'paid', 'failed', 'cancelled', 'expired'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user
  ON public.checkout_sessions (user_id, created_at DESC);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own checkout_sessions" ON public.checkout_sessions;
CREATE POLICY "Users select own checkout_sessions"
  ON public.checkout_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own checkout_sessions" ON public.checkout_sessions;
CREATE POLICY "Users insert own checkout_sessions"
  ON public.checkout_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own checkout_sessions" ON public.checkout_sessions;
CREATE POLICY "Users update own checkout_sessions"
  ON public.checkout_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) Link orders + payment_transactions
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid
    REFERENCES public.checkout_sessions(id);

CREATE INDEX IF NOT EXISTS idx_orders_checkout_session
  ON public.orders (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid
    REFERENCES public.checkout_sessions(id);

CREATE INDEX IF NOT EXISTS idx_payment_tx_checkout_session
  ON public.payment_transactions (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

-- Optional FK for anchor (after orders exist); soft — no ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkout_sessions_anchor_order_fkey'
  ) THEN
    ALTER TABLE public.checkout_sessions
      ADD CONSTRAINT checkout_sessions_anchor_order_fkey
      FOREIGN KEY (anchor_order_id) REFERENCES public.orders(id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'anchor_order FK skipped: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 4) get_checkout_group_compat(p_store_ids)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_checkout_group_compat(p_store_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stores jsonb := '[]'::jsonb;
  v_sid uuid;
  v_owner uuid;
  v_policy text;
  v_shop text;
  v_momo boolean;
  v_card boolean;
  v_cod boolean;
  v_off boolean;
  v_wa boolean;
  v_row jsonb;
  v_count int;
  v_solo int;
  v_owners int;
  v_has_own boolean;
  v_not_multi int;
  v_deferred_only int;
  v_online int;
  v_methods jsonb := '[]'::jsonb;
  v_ok boolean := false;
  v_reason text := 'EMPTY';
  v_blocking uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_store_ids IS NULL OR cardinality(p_store_ids) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reasonCode', 'EMPTY',
      'eligiblePaymentMethods', '[]'::jsonb,
      'blockingStoreIds', '[]'::jsonb,
      'allDeferred', false
    );
  END IF;

  FOREACH v_sid IN ARRAY p_store_ids LOOP
    SELECT s.owner_id,
           COALESCE(s.group_checkout_policy, 'solo_only'),
           COALESCE(s.shop_type, 'international'),
           COALESCE(o.vendor_mobile_money_enabled, true),
           COALESCE(o.vendor_card_enabled, true),
           COALESCE(o.vendor_cod_enabled, false),
           COALESCE(o.vendor_off_platform_enabled, false),
           COALESCE(o.vendor_whatsapp_enabled, false)
    INTO v_owner, v_policy, v_shop, v_momo, v_card, v_cod, v_off, v_wa
    FROM public.stores s
    LEFT JOIN public.vendor_pricing_overrides o ON o.store_id = s.id
    WHERE s.id = v_sid;

    IF v_owner IS NULL THEN
      CONTINUE;
    END IF;

    v_row := jsonb_build_object(
      'id', v_sid,
      'owner_id', v_owner,
      'shop_type', v_shop,
      'group_checkout_policy', v_policy,
      'paymentFlags', jsonb_build_object(
        'mobile_money', v_momo,
        'card', v_card,
        'paypal', true,
        'cod', v_cod,
        'off_platform', v_off,
        'whatsapp', v_wa
      )
    );
    v_stores := v_stores || jsonb_build_array(v_row);
  END LOOP;

  v_count := jsonb_array_length(v_stores);
  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'reasonCode', 'EMPTY',
      'eligiblePaymentMethods', '[]'::jsonb,
      'blockingStoreIds', '[]'::jsonb, 'allDeferred', false
    );
  END IF;

  IF v_count = 1 THEN
    v_methods := '[]'::jsonb;
    IF (v_stores->0->'paymentFlags'->>'mobile_money')::boolean THEN
      v_methods := v_methods || '["mobile_money"]'::jsonb;
    END IF;
    IF (v_stores->0->'paymentFlags'->>'card')::boolean THEN
      v_methods := v_methods || '["card"]'::jsonb;
    END IF;
    IF (v_stores->0->'paymentFlags'->>'paypal')::boolean THEN
      v_methods := v_methods || '["paypal"]'::jsonb;
    END IF;
    IF (v_stores->0->'paymentFlags'->>'cod')::boolean THEN
      v_methods := v_methods || '["cod"]'::jsonb;
    END IF;
    IF (v_stores->0->'paymentFlags'->>'off_platform')::boolean THEN
      v_methods := v_methods || '["off_platform"]'::jsonb;
    END IF;
    IF (v_stores->0->'paymentFlags'->>'whatsapp')::boolean THEN
      v_methods := v_methods || '["whatsapp"]'::jsonb;
    END IF;
    v_ok := jsonb_array_length(v_methods) > 0;
    RETURN jsonb_build_object(
      'ok', v_ok,
      'reasonCode', CASE WHEN v_ok THEN 'OK' ELSE 'NO_COMMON_PAYMENT_METHOD' END,
      'eligiblePaymentMethods', v_methods,
      'blockingStoreIds', CASE WHEN v_ok THEN '[]'::jsonb ELSE jsonb_build_array(v_stores->0->>'id') END,
      'allDeferred', (
        NOT COALESCE((v_stores->0->'paymentFlags'->>'mobile_money')::boolean, false)
        AND NOT COALESCE((v_stores->0->'paymentFlags'->>'card')::boolean, false)
        AND NOT COALESCE((v_stores->0->'paymentFlags'->>'paypal')::boolean, false)
        AND (
          COALESCE((v_stores->0->'paymentFlags'->>'cod')::boolean, false)
          OR COALESCE((v_stores->0->'paymentFlags'->>'off_platform')::boolean, false)
          OR COALESCE((v_stores->0->'paymentFlags'->>'whatsapp')::boolean, false)
        )
      )
    );
  END IF;

  -- solo_only blockers
  SELECT COUNT(*), COALESCE(array_agg((s->>'id')::uuid), ARRAY[]::uuid[])
  INTO v_solo, v_blocking
  FROM jsonb_array_elements(v_stores) s
  WHERE s->>'group_checkout_policy' = 'solo_only';

  IF v_solo > 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'reasonCode', 'SOLO_ONLY',
      'eligiblePaymentMethods', '[]'::jsonb,
      'blockingStoreIds', to_jsonb(v_blocking), 'allDeferred', false
    );
  END IF;

  SELECT COUNT(DISTINCT s->>'owner_id') INTO v_owners
  FROM jsonb_array_elements(v_stores) s;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_stores) s
    WHERE s->>'group_checkout_policy' = 'own_stores_only'
  ) INTO v_has_own;

  IF v_has_own AND v_owners > 1 THEN
    SELECT COALESCE(array_agg((s->>'id')::uuid), ARRAY[]::uuid[])
    INTO v_blocking
    FROM jsonb_array_elements(v_stores) s
    WHERE s->>'group_checkout_policy' = 'own_stores_only';
    RETURN jsonb_build_object(
      'ok', false, 'reasonCode', 'OWN_STORES_MISMATCH',
      'eligiblePaymentMethods', '[]'::jsonb,
      'blockingStoreIds', to_jsonb(v_blocking), 'allDeferred', false
    );
  END IF;

  IF v_owners > 1 THEN
    SELECT COUNT(*), COALESCE(array_agg((s->>'id')::uuid), ARRAY[]::uuid[])
    INTO v_not_multi, v_blocking
    FROM jsonb_array_elements(v_stores) s
    WHERE s->>'group_checkout_policy' <> 'multi_vendor_ok';
    IF v_not_multi > 0 THEN
      RETURN jsonb_build_object(
        'ok', false, 'reasonCode', 'MULTI_VENDOR_REQUIRED',
        'eligiblePaymentMethods', '[]'::jsonb,
        'blockingStoreIds', to_jsonb(v_blocking), 'allDeferred', false
      );
    END IF;
  END IF;

  -- Mix deferred-only vs online
  SELECT COUNT(*) INTO v_deferred_only
  FROM jsonb_array_elements(v_stores) s
  WHERE NOT COALESCE((s->'paymentFlags'->>'mobile_money')::boolean, false)
    AND NOT COALESCE((s->'paymentFlags'->>'card')::boolean, false)
    AND NOT COALESCE((s->'paymentFlags'->>'paypal')::boolean, false)
    AND (
      COALESCE((s->'paymentFlags'->>'cod')::boolean, false)
      OR COALESCE((s->'paymentFlags'->>'off_platform')::boolean, false)
      OR COALESCE((s->'paymentFlags'->>'whatsapp')::boolean, false)
    );

  SELECT COUNT(*) INTO v_online
  FROM jsonb_array_elements(v_stores) s
  WHERE COALESCE((s->'paymentFlags'->>'mobile_money')::boolean, false)
     OR COALESCE((s->'paymentFlags'->>'card')::boolean, false)
     OR COALESCE((s->'paymentFlags'->>'paypal')::boolean, false);

  IF v_deferred_only > 0 AND v_online > 0 THEN
    SELECT COALESCE(array_agg((s->>'id')::uuid), ARRAY[]::uuid[])
    INTO v_blocking
    FROM jsonb_array_elements(v_stores) s;
    RETURN jsonb_build_object(
      'ok', false, 'reasonCode', 'MIXED_PAYMENT_MODEL',
      'eligiblePaymentMethods', '[]'::jsonb,
      'blockingStoreIds', to_jsonb(v_blocking), 'allDeferred', false
    );
  END IF;

  -- Intersection
  v_methods := '[]'::jsonb;
  IF (
    SELECT bool_and(COALESCE((s->'paymentFlags'->>'mobile_money')::boolean, false))
    FROM jsonb_array_elements(v_stores) s
  ) THEN
    v_methods := v_methods || '["mobile_money"]'::jsonb;
  END IF;
  IF (
    SELECT bool_and(COALESCE((s->'paymentFlags'->>'card')::boolean, false))
    FROM jsonb_array_elements(v_stores) s
  ) THEN
    v_methods := v_methods || '["card"]'::jsonb;
  END IF;
  IF (
    SELECT bool_and(COALESCE((s->'paymentFlags'->>'paypal')::boolean, false))
    FROM jsonb_array_elements(v_stores) s
  ) THEN
    v_methods := v_methods || '["paypal"]'::jsonb;
  END IF;
  IF (
    SELECT bool_and(COALESCE((s->'paymentFlags'->>'cod')::boolean, false))
    FROM jsonb_array_elements(v_stores) s
  ) THEN
    v_methods := v_methods || '["cod"]'::jsonb;
  END IF;
  IF (
    SELECT bool_and(COALESCE((s->'paymentFlags'->>'off_platform')::boolean, false))
    FROM jsonb_array_elements(v_stores) s
  ) THEN
    v_methods := v_methods || '["off_platform"]'::jsonb;
  END IF;
  IF (
    SELECT bool_and(COALESCE((s->'paymentFlags'->>'whatsapp')::boolean, false))
    FROM jsonb_array_elements(v_stores) s
  ) THEN
    v_methods := v_methods || '["whatsapp"]'::jsonb;
  END IF;

  IF jsonb_array_length(v_methods) = 0 THEN
    SELECT COALESCE(array_agg((s->>'id')::uuid), ARRAY[]::uuid[])
    INTO v_blocking
    FROM jsonb_array_elements(v_stores) s;
    RETURN jsonb_build_object(
      'ok', false, 'reasonCode', 'NO_COMMON_PAYMENT_METHOD',
      'eligiblePaymentMethods', '[]'::jsonb,
      'blockingStoreIds', to_jsonb(v_blocking), 'allDeferred', false
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reasonCode', 'OK',
    'eligiblePaymentMethods', v_methods,
    'blockingStoreIds', '[]'::jsonb,
    'allDeferred', (
      SELECT bool_and(
        m IN ('cod', 'off_platform', 'whatsapp')
      )
      FROM jsonb_array_elements_text(v_methods) AS t(m)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_checkout_group_compat(uuid[]) IS
  'Evaluate multi-store checkout session eligibility (mirror frontend checkout-group-compat).';

REVOKE ALL ON FUNCTION public.get_checkout_group_compat(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_group_compat(uuid[]) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) confirm_checkout_session_payment (idempotent, service-role intended)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_checkout_session_payment(
  p_session_id uuid,
  p_tx_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.checkout_sessions%ROWTYPE;
  v_tx_amount numeric(12,2);
  v_expected numeric(12,2);
  v_updated int := 0;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_session');
  END IF;

  SELECT * INTO v_session FROM public.checkout_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  IF v_session.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'paid');
  END IF;

  -- Optional amount check when tx provided
  IF p_tx_id IS NOT NULL THEN
    SELECT amount INTO v_tx_amount FROM public.payment_transactions WHERE id = p_tx_id;
    SELECT COALESCE(SUM(
      GREATEST(0, ROUND((COALESCE(o.total, 0) - COALESCE(o.wallet_credit_applied, 0))::numeric, 2))
    ), 0)
    INTO v_expected
    FROM public.orders o
    WHERE o.checkout_session_id = p_session_id
      AND o.status IN ('awaiting_payment', 'pending');

    IF v_tx_amount IS NOT NULL AND ABS(COALESCE(v_tx_amount, 0) - COALESCE(v_expected, 0)) > 0.02
       AND v_expected > 0 THEN
      -- Allow small drift only; if expected already 0 (wallet covered) skip
      IF v_expected > 0 THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'amount_mismatch',
          'expected', v_expected,
          'tx_amount', v_tx_amount
        );
      END IF;
    END IF;

    UPDATE public.payment_transactions
    SET checkout_session_id = p_session_id
    WHERE id = p_tx_id AND checkout_session_id IS NULL;
  END IF;

  UPDATE public.orders o
  SET
    status = 'pending',
    shipping_payment_status = CASE
      WHEN o.shipping_payment_status = 'unpaid' THEN 'paid'
      ELSE o.shipping_payment_status
    END,
    last_mile_payment_status = CASE
      WHEN o.last_mile_payment_status = 'unpaid' THEN 'paid'
      ELSE o.last_mile_payment_status
    END
  WHERE o.checkout_session_id = p_session_id
    AND o.status IN ('awaiting_payment', 'pending');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.checkout_sessions
  SET status = 'paid',
      paid_at = COALESCE(paid_at, now()),
      updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true, 'orders_updated', v_updated, 'status', 'paid');
END;
$$;

COMMENT ON FUNCTION public.confirm_checkout_session_payment(uuid, uuid) IS
  'Mark all session orders paid after successful gateway charge. Idempotent.';

REVOKE ALL ON FUNCTION public.confirm_checkout_session_payment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_checkout_session_payment(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) fail_checkout_session_payment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fail_checkout_session_payment(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_session');
  END IF;

  UPDATE public.orders
  SET status = 'payment_failed'
  WHERE checkout_session_id = p_session_id
    AND status = 'awaiting_payment';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.checkout_sessions
  SET status = 'failed', updated_at = now()
  WHERE id = p_session_id
    AND status IN ('open', 'payment_pending');

  RETURN jsonb_build_object('ok', true, 'orders_updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.fail_checkout_session_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_checkout_session_payment(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) vendor_update_group_checkout_policy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_update_group_checkout_policy(
  p_store_id uuid,
  p_policy text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_policy IS NULL OR p_policy NOT IN ('solo_only', 'own_stores_only', 'multi_vendor_ok') THEN
    RAISE EXCEPTION 'Invalid group_checkout_policy';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id AND s.owner_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.stores
  SET group_checkout_policy = p_policy
  WHERE id = p_store_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_update_group_checkout_policy(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_update_group_checkout_policy(uuid, text) TO authenticated;
