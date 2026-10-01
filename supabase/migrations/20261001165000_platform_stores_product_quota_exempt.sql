-- Purpose: Platform-owned / claimed stores are exempt from product catalogue quotas.
-- Symptom: /vendor Catalogue empty or capped (e.g. 457 / 20) for is_platform_owned shops.
-- Also: collaborators can SELECT products of assigned stores (parity with stores RLS).
-- Tables: get_store_entitlements RPC; products SELECT policies
-- Risk: low — additive exemption + broader SELECT for team; no data mutation.
-- Staging → production: apply ASAP; smoke platform store catalogue + add product.
-- Rollback: re-deploy prior get_store_entitlements body; drop new products policy.

-- ---------------------------------------------------------------------------
-- 1) get_store_entitlements: unlimited max_products when stores.is_platform_owned
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_entitlements(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_is_platform boolean := false;
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

  SELECT COALESCE(s.is_platform_owned, false), s.max_collaborators_override
  INTO v_is_platform, v_collab_store
  FROM public.stores s
  WHERE s.id = p_store_id;

  SELECT COALESCE(vs.tier, 'beginner') INTO v_tier
  FROM public.vendor_subscriptions vs
  WHERE vs.store_id = p_store_id;

  IF v_tier IS NULL THEN v_tier := 'beginner'; END IF;
  IF v_tier = 'grand_supplier' THEN v_tier := 'enterprise'; END IF;

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

  SELECT
    o.max_products_override, o.max_stores_override, o.collaborator_limit_override,
    o.vendor_cod_enabled, o.vendor_off_platform_enabled, o.vendor_whatsapp_enabled,
    o.vendor_custom_payment_numbers_enabled
  INTO
    v_override_products, v_override_stores, v_collab_limit,
    v_cod_ov, v_off_ov, v_wa_ov, v_mm_custom_ov
  FROM public.vendor_pricing_overrides o
  WHERE o.store_id = p_store_id;

  IF v_cod_ov IS TRUE THEN
    v_features := v_features || jsonb_build_object('cod_payment', true);
  ELSIF v_cod_ov IS FALSE THEN
    v_features := v_features || jsonb_build_object('cod_payment', false);
  END IF;
  IF v_off_ov IS TRUE THEN
    v_features := v_features || jsonb_build_object('off_platform_payment', true);
  ELSIF v_off_ov IS FALSE THEN
    v_features := v_features || jsonb_build_object('off_platform_payment', false);
  END IF;
  IF v_mm_custom_ov IS TRUE THEN
    v_features := v_features || jsonb_build_object('custom_payment_numbers', true);
  ELSIF v_mm_custom_ov IS FALSE THEN
    v_features := v_features || jsonb_build_object('custom_payment_numbers', false);
  END IF;
  IF v_wa_ov IS TRUE THEN
    v_features := v_features || jsonb_build_object('whatsapp_store', true);
  ELSIF v_wa_ov IS FALSE THEN
    v_features := v_features || jsonb_build_object('whatsapp_store', false);
  END IF;

  FOR v_key IN
    SELECT e.feature_key FROM public.store_feature_entitlements e
    WHERE e.store_id = p_store_id AND e.source = 'admin_revoke'
  LOOP
    v_features := v_features || jsonb_build_object(v_key, false);
  END LOOP;

  v_max_stores := COALESCE(v_override_stores, v_plan.max_stores, 1);

  -- Platform-owned / claimed shops: no product catalogue cap
  IF v_is_platform IS TRUE THEN
    v_max_products := NULL;
  ELSE
    v_max_products := COALESCE(v_override_products, v_plan.max_products, 20);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_slug', v_plan.slug,
    'plan_label', v_plan.label,
    'max_products', v_max_products,
    'max_stores', v_max_stores,
    'product_quota_exempt', v_is_platform,
    'is_platform_owned', v_is_platform,
    'collaborator_limit', COALESCE(v_collab_limit, v_collab_store),
    'included_deliveries_per_month', v_plan.included_deliveries_per_month,
    'max_kg_per_included_delivery', v_plan.max_kg_per_included_delivery,
    'features', v_features
  );
END;
$$;

COMMENT ON FUNCTION public.get_store_entitlements(uuid) IS
  'Resolved features + quotas. Platform-owned stores: product_quota_exempt, max_products null (unlimited).';

-- ---------------------------------------------------------------------------
-- 2) Products SELECT: owner OR active collaborator (fixes empty catalogue for team)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Store owners read own products" ON public.products;
DROP POLICY IF EXISTS "Store team read own products" ON public.products;
CREATE POLICY "Store team read own products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = products.store_id
        AND s.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = products.store_id
        AND sc.user_id = auth.uid()
        AND sc.status = 'active'
    )
  );

COMMENT ON POLICY "Store team read own products" ON public.products IS
  'Owner + active collaborators; admins/managers keep separate policies.';
