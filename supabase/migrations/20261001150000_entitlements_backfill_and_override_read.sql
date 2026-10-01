-- Purpose: Phase C1 — backfill COD/off-platform entitlements; extend get_store_entitlements
--          with pricing kill-switches + collaborator_limit; dual-read checkout payment flags.
-- Tables: store_feature_entitlements (backfill); RPCs get_store_entitlements,
--         get_checkout_vendor_payment_flags, store_whatsapp_checkout_allowed
-- Risk: low-medium additive. Dual-read preserves existing override=true behavior.
-- Staging → production: after 20261001142000; smoke COD/off-plat checkout + get_store_entitlements.
-- Rollback: restore prior RPC bodies from 20260921200000 / 20261001142000; DELETE backfill rows if needed.

-- ---------------------------------------------------------------------------
-- 1) Backfill COD / off-platform from pricing overrides
-- ---------------------------------------------------------------------------
INSERT INTO public.store_feature_entitlements (store_id, feature_key, source, enabled)
SELECT o.store_id, 'cod_payment', 'admin_grant', true
FROM public.vendor_pricing_overrides o
WHERE COALESCE(o.vendor_cod_enabled, false) = true
ON CONFLICT (store_id, feature_key, source) DO NOTHING;

INSERT INTO public.store_feature_entitlements (store_id, feature_key, source, enabled)
SELECT o.store_id, 'off_platform_payment', 'admin_grant', true
FROM public.vendor_pricing_overrides o
WHERE COALESCE(o.vendor_off_platform_enabled, false) = true
ON CONFLICT (store_id, feature_key, source) DO NOTHING;

INSERT INTO public.store_feature_entitlements (store_id, feature_key, source, enabled)
SELECT o.store_id, 'custom_payment_numbers', 'admin_grant', true
FROM public.vendor_pricing_overrides o
WHERE COALESCE(o.vendor_custom_payment_numbers_enabled, false) = true
ON CONFLICT (store_id, feature_key, source) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Extended get_store_entitlements (pricing dual-read + collab limit)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_entitlements(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_plan public.vendor_plan_definitions%ROWTYPE;
  v_features jsonb := '{}'::jsonb;
  v_key text;
  v_enabled boolean;
  v_max_products int;
  v_max_stores int;
  v_override_products int;
  v_override_stores int;
  v_collab_limit int;
  v_collab_store int;
  v_included text[];
  v_cod_ov boolean;
  v_off_ov boolean;
  v_wa_ov boolean;
  v_mm_custom_ov boolean;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store');
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p_store_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = p_store_id AND sc.user_id = auth.uid() AND sc.status = 'active'
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(vs.tier, 'beginner') INTO v_tier
  FROM public.vendor_subscriptions vs
  WHERE vs.store_id = p_store_id;

  IF v_tier IS NULL THEN
    v_tier := 'beginner';
  END IF;
  IF v_tier = 'grand_supplier' THEN
    v_tier := 'enterprise';
  END IF;

  SELECT * INTO v_plan FROM public.vendor_plan_definitions WHERE slug = v_tier AND is_active;
  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.vendor_plan_definitions WHERE slug = 'beginner';
  END IF;

  v_included := COALESCE(v_plan.included_feature_keys, ARRAY[]::text[]);

  FOREACH v_key IN ARRAY v_included LOOP
    v_features := v_features || jsonb_build_object(v_key, true);
  END LOOP;

  FOR v_key, v_enabled IN
    SELECT e.feature_key, e.enabled
    FROM public.store_feature_entitlements e
    WHERE e.store_id = p_store_id
      AND e.source = 'addon'
      AND (e.paid_until IS NULL OR e.paid_until > now())
  LOOP
    v_features := v_features || jsonb_build_object(v_key, v_enabled);
  END LOOP;

  FOR v_key IN
    SELECT e.feature_key FROM public.store_feature_entitlements e
    WHERE e.store_id = p_store_id AND e.source = 'admin_grant' AND e.enabled
  LOOP
    v_features := v_features || jsonb_build_object(v_key, true);
  END LOOP;

  FOR v_key IN
    SELECT e.feature_key FROM public.store_feature_entitlements e
    WHERE e.store_id = p_store_id AND e.source = 'admin_revoke'
  LOOP
    v_features := v_features || jsonb_build_object(v_key, false);
  END LOOP;

  -- Dual-read pricing overrides (kill-switch / force-enable while admin UI still writes overrides)
  SELECT
    o.max_products_override,
    o.max_stores_override,
    o.collaborator_limit_override,
    o.vendor_cod_enabled,
    o.vendor_off_platform_enabled,
    o.vendor_whatsapp_enabled,
    o.vendor_custom_payment_numbers_enabled
  INTO
    v_override_products,
    v_override_stores,
    v_collab_limit,
    v_cod_ov,
    v_off_ov,
    v_wa_ov,
    v_mm_custom_ov
  FROM public.vendor_pricing_overrides o
  WHERE o.store_id = p_store_id;

  IF COALESCE(v_cod_ov, false) THEN
    v_features := v_features || jsonb_build_object('cod_payment', true);
  END IF;
  IF COALESCE(v_off_ov, false) THEN
    v_features := v_features || jsonb_build_object('off_platform_payment', true);
  END IF;
  IF COALESCE(v_mm_custom_ov, false) THEN
    v_features := v_features || jsonb_build_object('custom_payment_numbers', true);
  END IF;
  -- Explicit WA kill-switch on override false removes feature even if plan/grant
  IF v_wa_ov IS NOT NULL AND v_wa_ov = false THEN
    v_features := v_features || jsonb_build_object('whatsapp_store', false);
  ELSIF COALESCE(v_wa_ov, false) THEN
    v_features := v_features || jsonb_build_object('whatsapp_store', true);
  END IF;

  SELECT s.max_collaborators_override INTO v_collab_store
  FROM public.stores s WHERE s.id = p_store_id;

  v_max_products := COALESCE(v_override_products, v_plan.max_products, 20);
  v_max_stores := COALESCE(v_override_stores, v_plan.max_stores, 1);

  RETURN jsonb_build_object(
    'ok', true,
    'plan_slug', v_plan.slug,
    'plan_label', v_plan.label,
    'max_products', v_max_products,
    'max_stores', v_max_stores,
    'collaborator_limit', COALESCE(v_collab_limit, v_collab_store),
    'included_deliveries_per_month', v_plan.included_deliveries_per_month,
    'max_kg_per_included_delivery', v_plan.max_kg_per_included_delivery,
    'features', v_features
  );
END;
$$;

COMMENT ON FUNCTION public.get_store_entitlements(uuid) IS
  'Resolved features + quotas: admin_revoke > pricing dual-read > admin_grant > addon > plan.';

GRANT EXECUTE ON FUNCTION public.get_store_entitlements(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Checkout flags: override OR entitlement feature (buyer-safe)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_checkout_vendor_payment_flags(uuid[]);

CREATE FUNCTION public.get_checkout_vendor_payment_flags(p_store_ids uuid[])
RETURNS TABLE (
  store_id uuid,
  vendor_cod_enabled boolean,
  vendor_off_platform_enabled boolean,
  vendor_mobile_money_enabled boolean,
  vendor_card_enabled boolean,
  vendor_whatsapp_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sid.id AS store_id,
    (
      COALESCE(o.vendor_cod_enabled, false)
      OR EXISTS (
        SELECT 1 FROM public.store_feature_entitlements e
        WHERE e.store_id = sid.id AND e.feature_key = 'cod_payment'
          AND e.source = 'admin_grant' AND e.enabled
      )
      OR EXISTS (
        SELECT 1
        FROM public.vendor_subscriptions vs
        JOIN public.vendor_plan_definitions p ON p.slug = CASE
          WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
          ELSE vs.tier::text
        END AND p.is_active
        WHERE vs.store_id = sid.id
          AND 'cod_payment' = ANY (p.included_feature_keys)
          AND NOT EXISTS (
            SELECT 1 FROM public.store_feature_entitlements r
            WHERE r.store_id = sid.id AND r.feature_key = 'cod_payment' AND r.source = 'admin_revoke'
          )
      )
    ) AS vendor_cod_enabled,
    (
      COALESCE(o.vendor_off_platform_enabled, false)
      OR EXISTS (
        SELECT 1 FROM public.store_feature_entitlements e
        WHERE e.store_id = sid.id AND e.feature_key = 'off_platform_payment'
          AND e.source = 'admin_grant' AND e.enabled
      )
      OR EXISTS (
        SELECT 1
        FROM public.vendor_subscriptions vs
        JOIN public.vendor_plan_definitions p ON p.slug = CASE
          WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
          ELSE vs.tier::text
        END AND p.is_active
        WHERE vs.store_id = sid.id
          AND 'off_platform_payment' = ANY (p.included_feature_keys)
          AND NOT EXISTS (
            SELECT 1 FROM public.store_feature_entitlements r
            WHERE r.store_id = sid.id AND r.feature_key = 'off_platform_payment' AND r.source = 'admin_revoke'
          )
      )
    ) AS vendor_off_platform_enabled,
    COALESCE(o.vendor_mobile_money_enabled, true) AS vendor_mobile_money_enabled,
    COALESCE(o.vendor_card_enabled, true) AS vendor_card_enabled,
    (
      CASE
        WHEN o.vendor_whatsapp_enabled IS NOT NULL AND o.vendor_whatsapp_enabled = false THEN false
        ELSE (
          COALESCE(o.vendor_whatsapp_enabled, false)
          OR EXISTS (
            SELECT 1 FROM public.store_feature_entitlements e
            WHERE e.store_id = sid.id AND e.feature_key = 'whatsapp_store'
              AND e.source = 'admin_grant' AND e.enabled
          )
          OR EXISTS (
            SELECT 1
            FROM public.vendor_subscriptions vs
            JOIN public.vendor_plan_definitions p ON p.slug = CASE
              WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
              ELSE vs.tier::text
            END AND p.is_active
            WHERE vs.store_id = sid.id
              AND 'whatsapp_store' = ANY (p.included_feature_keys)
              AND NOT EXISTS (
                SELECT 1 FROM public.store_feature_entitlements r
                WHERE r.store_id = sid.id AND r.feature_key = 'whatsapp_store' AND r.source = 'admin_revoke'
              )
          )
          OR COALESCE(vs_wa.is_whatsapp_enabled, false)
        )
      END
    ) AS vendor_whatsapp_enabled
  FROM unnest(COALESCE(p_store_ids, ARRAY[]::uuid[])) AS sid(id)
  LEFT JOIN public.vendor_pricing_overrides o ON o.store_id = sid.id
  LEFT JOIN public.vendor_subscriptions vs_wa ON vs_wa.store_id = sid.id;
$$;

COMMENT ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) IS
  'Checkout-safe flags: pricing override OR plan/entitlement (dual-read). WA kill-switch override=false wins.';

REVOKE ALL ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) TO anon, authenticated;

-- Align WhatsApp eligibility with dual-read (override false still kills)
CREATE OR REPLACE FUNCTION public.store_whatsapp_checkout_allowed(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean := false;
  v_digits text;
  v_sub_enabled boolean;
  v_flags record;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_flags
  FROM public.get_checkout_vendor_payment_flags(ARRAY[p_store_id]);

  v_enabled := COALESCE(v_flags.vendor_whatsapp_enabled, false);
  IF NOT v_enabled THEN
    RETURN false;
  END IF;

  SELECT regexp_replace(COALESCE(s.whatsapp_number, ''), '[^0-9]', '', 'g')
  INTO v_digits
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF v_digits IS NULL OR length(v_digits) < 8 THEN
    RETURN false;
  END IF;

  SELECT COALESCE(vs.is_whatsapp_enabled, true)
  INTO v_sub_enabled
  FROM public.vendor_subscriptions vs
  WHERE vs.store_id = p_store_id;

  IF v_sub_enabled IS NOT NULL AND v_sub_enabled = false THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
