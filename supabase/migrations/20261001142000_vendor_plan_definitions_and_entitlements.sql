-- Purpose: Dynamic vendor plan definitions + per-store feature entitlements foundation.
-- Tables: vendor_plan_definitions, store_feature_entitlements;
--         vendor_pricing_overrides.max_stores_override;
--         RPC get_store_entitlements
-- Risk: low-medium additive. Backfill grants preserve existing WhatsApp/coupons/team flags.
-- Note: Runtime checkout lanes / hub billing are Phase C (not this migration).
-- Staging → production: run after 20261001140000 / 20261001141000.

-- ---------------------------------------------------------------------------
-- 1) Plan definitions (admin-editable; seed = product vision)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_plan_definitions (
  slug text PRIMARY KEY,
  label text NOT NULL,
  rank int NOT NULL DEFAULT 0,
  max_products int NOT NULL DEFAULT 20 CHECK (max_products > 0),
  max_stores int NOT NULL DEFAULT 1 CHECK (max_stores > 0),
  included_feature_keys text[] NOT NULL DEFAULT '{}',
  included_deliveries_per_month int NOT NULL DEFAULT 0 CHECK (included_deliveries_per_month >= 0),
  max_kg_per_included_delivery numeric NOT NULL DEFAULT 10 CHECK (max_kg_per_included_delivery > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendor_plan_definitions IS
  'Vendor commercial plans (beginner/intermediate/pro/enterprise). Source of quotas + included features.';
COMMENT ON COLUMN public.vendor_plan_definitions.max_kg_per_included_delivery IS
  'Max kg per order using included last-mile deliveries (Enterprise = 10).';

ALTER TABLE public.vendor_plan_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated read vendor plans" ON public.vendor_plan_definitions;
CREATE POLICY "Anyone authenticated read vendor plans"
  ON public.vendor_plan_definitions FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage vendor plans" ON public.vendor_plan_definitions;
CREATE POLICY "Admins manage vendor plans"
  ON public.vendor_plan_definitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.vendor_plan_definitions (
  slug, label, rank, max_products, max_stores,
  included_feature_keys, included_deliveries_per_month, max_kg_per_included_delivery
) VALUES
  (
    'beginner', 'Débutant', 10, 20, 1,
    ARRAY[]::text[],
    0, 10
  ),
  (
    'intermediate', 'Intermédiaire', 20, 50, 2,
    ARRAY['custom_payment_numbers', 'coupons'],
    0, 10
  ),
  (
    'pro', 'Professionnel', 30, 100, 5,
    ARRAY[
      'custom_payment_numbers', 'coupons',
      'whatsapp_store', 'self_delivery', 'supplier_management'
    ],
    0, 10
  ),
  (
    'enterprise', 'Entreprise', 40, 250, 10,
    ARRAY[
      'custom_payment_numbers', 'coupons',
      'whatsapp_store', 'self_delivery', 'supplier_management',
      'auto_margin_calc', 'cod_payment', 'off_platform_payment', 'collaborators'
    ],
    4, 10
  )
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  rank = EXCLUDED.rank,
  max_products = EXCLUDED.max_products,
  max_stores = EXCLUDED.max_stores,
  included_feature_keys = EXCLUDED.included_feature_keys,
  included_deliveries_per_month = EXCLUDED.included_deliveries_per_month,
  max_kg_per_included_delivery = EXCLUDED.max_kg_per_included_delivery,
  updated_at = now();

-- Alias legacy grand_supplier → same as enterprise (for old vendor_subscriptions.tier rows)
INSERT INTO public.vendor_plan_definitions (
  slug, label, rank, max_products, max_stores,
  included_feature_keys, included_deliveries_per_month, max_kg_per_included_delivery
)
SELECT
  'grand_supplier', 'Entreprise (legacy)', 40, 250, 10,
  included_feature_keys, included_deliveries_per_month, max_kg_per_included_delivery
FROM public.vendor_plan_definitions WHERE slug = 'enterprise'
ON CONFLICT (slug) DO UPDATE SET
  max_products = EXCLUDED.max_products,
  max_stores = EXCLUDED.max_stores,
  included_feature_keys = EXCLUDED.included_feature_keys,
  included_deliveries_per_month = EXCLUDED.included_deliveries_per_month,
  max_kg_per_included_delivery = EXCLUDED.max_kg_per_included_delivery,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Per-store feature entitlements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_feature_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('plan', 'addon', 'admin_grant', 'admin_revoke')),
  enabled boolean NOT NULL DEFAULT true,
  paid_until timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, feature_key, source)
);

CREATE INDEX IF NOT EXISTS idx_store_feature_entitlements_store
  ON public.store_feature_entitlements (store_id);

ALTER TABLE public.store_feature_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store team read entitlements" ON public.store_feature_entitlements;
CREATE POLICY "Store team read entitlements"
  ON public.store_feature_entitlements FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = store_feature_entitlements.store_id
        AND sc.user_id = auth.uid() AND sc.status = 'active'
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS "Admins manage entitlements" ON public.store_feature_entitlements;
CREATE POLICY "Admins manage entitlements"
  ON public.store_feature_entitlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 3) max_stores_override on pricing overrides
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS max_stores_override int;

COMMENT ON COLUMN public.vendor_pricing_overrides.max_stores_override IS
  'Admin override for how many stores an owner may operate (null = use plan.max_stores).';

-- Ensure collaborator_limit_override exists (used by TeamTab / Pricing)
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS collaborator_limit_override int;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS max_collaborators_override int;

-- ---------------------------------------------------------------------------
-- 4) RPC get_store_entitlements
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
  v_included text[];
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store');
  END IF;

  -- Access: owner, collab, admin
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
  -- Legacy alias
  IF v_tier = 'grand_supplier' THEN
    v_tier := 'enterprise';
  END IF;

  SELECT * INTO v_plan FROM public.vendor_plan_definitions WHERE slug = v_tier AND is_active;
  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.vendor_plan_definitions WHERE slug = 'beginner';
  END IF;

  v_included := COALESCE(v_plan.included_feature_keys, ARRAY[]::text[]);

  -- Start from plan inclusions
  FOREACH v_key IN ARRAY v_included LOOP
    v_features := v_features || jsonb_build_object(v_key, true);
  END LOOP;

  -- Addons (enabled + not expired)
  FOR v_key, v_enabled IN
    SELECT e.feature_key, e.enabled
    FROM public.store_feature_entitlements e
    WHERE e.store_id = p_store_id
      AND e.source = 'addon'
      AND (e.paid_until IS NULL OR e.paid_until > now())
  LOOP
    v_features := v_features || jsonb_build_object(v_key, v_enabled);
  END LOOP;

  -- Admin grants
  FOR v_key IN
    SELECT e.feature_key FROM public.store_feature_entitlements e
    WHERE e.store_id = p_store_id AND e.source = 'admin_grant' AND e.enabled
  LOOP
    v_features := v_features || jsonb_build_object(v_key, true);
  END LOOP;

  -- Admin revokes win
  FOR v_key IN
    SELECT e.feature_key FROM public.store_feature_entitlements e
    WHERE e.store_id = p_store_id AND e.source = 'admin_revoke'
  LOOP
    v_features := v_features || jsonb_build_object(v_key, false);
  END LOOP;

  SELECT o.max_products_override, o.max_stores_override
    INTO v_override_products, v_override_stores
  FROM public.vendor_pricing_overrides o
  WHERE o.store_id = p_store_id;

  v_max_products := COALESCE(v_override_products, v_plan.max_products, 20);
  v_max_stores := COALESCE(v_override_stores, v_plan.max_stores, 1);

  RETURN jsonb_build_object(
    'ok', true,
    'plan_slug', v_plan.slug,
    'plan_label', v_plan.label,
    'max_products', v_max_products,
    'max_stores', v_max_stores,
    'included_deliveries_per_month', v_plan.included_deliveries_per_month,
    'max_kg_per_included_delivery', v_plan.max_kg_per_included_delivery,
    'features', v_features
  );
END;
$$;

COMMENT ON FUNCTION public.get_store_entitlements(uuid) IS
  'Resolved features + quotas: admin_revoke > admin_grant > addon > plan. Overrides for product/store caps.';

GRANT EXECUTE ON FUNCTION public.get_store_entitlements(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Backfill admin_grant from existing store / subscription flags (no rights lost)
-- ---------------------------------------------------------------------------
INSERT INTO public.store_feature_entitlements (store_id, feature_key, source, enabled)
SELECT s.id, 'coupons', 'admin_grant', true
FROM public.stores s
WHERE COALESCE(s.can_create_coupons, false) = true
ON CONFLICT (store_id, feature_key, source) DO NOTHING;

INSERT INTO public.store_feature_entitlements (store_id, feature_key, source, enabled)
SELECT s.id, 'collaborators', 'admin_grant', true
FROM public.stores s
WHERE COALESCE(s.collaborators_enabled, false) = true
ON CONFLICT (store_id, feature_key, source) DO NOTHING;

INSERT INTO public.store_feature_entitlements (store_id, feature_key, source, enabled)
SELECT vs.store_id, 'whatsapp_store', 'admin_grant', true
FROM public.vendor_subscriptions vs
WHERE COALESCE(vs.is_whatsapp_enabled, false) = true
ON CONFLICT (store_id, feature_key, source) DO NOTHING;

INSERT INTO public.store_feature_entitlements (store_id, feature_key, source, enabled)
SELECT vs.store_id, 'self_delivery', 'admin_grant', true
FROM public.vendor_subscriptions vs
WHERE COALESCE(vs.can_self_deliver, false) = true
ON CONFLICT (store_id, feature_key, source) DO NOTHING;

-- Ensure enum has enterprise (cannot use new value in same txn on some PG versions —
-- get_store_entitlements maps grand_supplier → enterprise plan row regardless).
ALTER TYPE public.vendor_tier ADD VALUE IF NOT EXISTS 'enterprise';
