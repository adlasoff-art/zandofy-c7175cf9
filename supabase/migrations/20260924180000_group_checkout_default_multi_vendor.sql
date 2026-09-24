-- Purpose: Marketplace default = multi_vendor_ok (1 client payment, N store orders).
-- Tables: stores.group_checkout_policy DEFAULT + backfill solo_only only;
--         get_checkout_group_compat COALESCE fallback aligned.
-- Risk (~4000+ users): medium-low — opens group cart; MIXED_PAYMENT_MODEL + session pay guards remain.
-- Rollback: ALTER DEFAULT 'solo_only'; UPDATE stores SET group_checkout_policy='solo_only' WHERE … (ops only).
-- Staging → prod: run this SQL after 24160000 + 24170000; then smoke 2-store MoMo.

ALTER TABLE public.stores
  ALTER COLUMN group_checkout_policy SET DEFAULT 'multi_vendor_ok';

UPDATE public.stores
SET group_checkout_policy = 'multi_vendor_ok'
WHERE group_checkout_policy = 'solo_only';

COMMENT ON COLUMN public.stores.group_checkout_policy IS
  'Default multi_vendor_ok. Vendors may opt down to own_stores_only or solo_only.';

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
           COALESCE(s.group_checkout_policy, 'multi_vendor_ok'),
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
