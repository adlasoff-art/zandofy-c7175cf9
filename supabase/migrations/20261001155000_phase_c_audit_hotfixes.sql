-- Purpose: Hotfix audit — restore profile SELECT; harden money RPCs (quota/hub);
--          revoke beats dual-read; local shop inherit gate; force lane from geo;
--          hub departed_at for accrue; advisory lock on quota.
-- Risk: medium — tightens authz; restores profile reads broken by 141000 DROP.
-- Staging → production: after 150000–154000; smoke login/profile, Enterprise consume,
--          local product inherit, mixed-cart shipping (frontend companion).
-- Rollback: restore prior function bodies from 150000/151000/154000 (explicit).

-- ---------------------------------------------------------------------------
-- 1) Profiles: recreate own SELECT (141000 dropped it; restrictive alone does not grant)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Soft-deleted: hide from other users; own row still readable for restore banner
DROP POLICY IF EXISTS "Hide soft-deleted profiles from non-admins" ON public.profiles;
DO $$
BEGIN
  CREATE POLICY "Hide soft-deleted profiles from non-admins"
    ON public.profiles
    AS RESTRICTIVE
    FOR SELECT
    TO authenticated
    USING (
      deleted_at IS NULL
      OR id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    );
EXCEPTION
  WHEN undefined_column THEN
    RAISE NOTICE 'profiles.deleted_at missing — skip restrictive soft-delete policy';
END $$;

-- ---------------------------------------------------------------------------
-- 2) Harden try_consume_included_delivery (authz + lane + lock + revoke anon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_consume_included_delivery(
  p_store_id uuid,
  p_order_id uuid,
  p_weight_kg numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_limit int := 0;
  v_used int := 0;
  v_max_kg numeric := 10;
  v_month text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_weight numeric;
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_lane text;
BEGIN
  IF p_store_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'missing_args');
  END IF;

  SELECT o.id, o.store_id, o.user_id, o.fulfillment_lane, o.geo_relation,
         o.delivery_choice, o.included_delivery_credit
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'order_not_found');
  END IF;

  IF v_order.store_id IS DISTINCT FROM p_store_id THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'store_mismatch');
  END IF;

  v_is_staff :=
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'manager'::app_role);

  -- Buyer of the order OR staff OR service_role (no JWT)
  IF v_uid IS NOT NULL
     AND v_order.user_id IS DISTINCT FROM v_uid
     AND NOT v_is_staff
  THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'forbidden');
  END IF;

  v_lane := COALESCE(
    v_order.fulfillment_lane,
    CASE v_order.geo_relation
      WHEN 'same_city' THEN 'last_mile'
      WHEN 'same_country_other_city' THEN 'domestic'
      WHEN 'cross_border' THEN 'freight'
      ELSE NULL
    END
  );

  IF v_lane IS DISTINCT FROM 'last_mile' THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'not_last_mile');
  END IF;

  IF COALESCE(v_order.delivery_choice, 'home_delivery') <> 'home_delivery' THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'not_home_delivery');
  END IF;

  IF EXISTS (SELECT 1 FROM public.store_included_delivery_usage WHERE order_id = p_order_id)
     OR COALESCE(v_order.included_delivery_credit, false)
  THEN
    UPDATE public.orders SET included_delivery_credit = true, last_mile_fee = 0 WHERE id = p_order_id;
    RETURN jsonb_build_object('consumed', true, 'reason', 'already_consumed');
  END IF;

  -- Server-side weight from order_items (ignore understated client weight)
  SELECT COALESCE(SUM(
    (COALESCE(NULLIF(p.weight_grams, 0), 500)::numeric * oi.quantity) / 1000.0
  ), COALESCE(p_weight_kg, 0))
  INTO v_weight
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;

  IF v_weight IS NULL OR v_weight <= 0 THEN
    v_weight := COALESCE(p_weight_kg, 0);
  END IF;

  SELECT COALESCE(pl.included_deliveries_per_month, 0),
         COALESCE(pl.max_kg_per_included_delivery, 10)
  INTO v_limit, v_max_kg
  FROM public.vendor_subscriptions vs
  JOIN public.vendor_plan_definitions pl ON pl.slug = CASE
    WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
    ELSE vs.tier::text
  END AND pl.is_active
  WHERE vs.store_id = p_store_id;

  IF COALESCE(v_limit, 0) <= 0 THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'no_quota');
  END IF;

  IF v_weight > v_max_kg THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'over_weight', 'max_kg', v_max_kg, 'weight_kg', v_weight);
  END IF;

  -- Serialize per store+month
  PERFORM pg_advisory_xact_lock(
    hashtext('included_delivery:' || p_store_id::text || ':' || v_month)
  );

  SELECT COUNT(*)::int INTO v_used
  FROM public.store_included_delivery_usage u
  WHERE u.store_id = p_store_id AND u.year_month = v_month;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'quota_exhausted', 'used', v_used, 'limit', v_limit);
  END IF;

  INSERT INTO public.store_included_delivery_usage (store_id, order_id, year_month, weight_kg)
  VALUES (p_store_id, p_order_id, v_month, v_weight);

  UPDATE public.orders
  SET included_delivery_credit = true,
      last_mile_fee = 0
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'consumed', true,
    'remaining', GREATEST(v_limit - v_used - 1, 0),
    'year_month', v_month,
    'weight_kg', v_weight
  );
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.orders SET included_delivery_credit = true, last_mile_fee = 0 WHERE id = p_order_id;
    RETURN jsonb_build_object('consumed', true, 'reason', 'race_already_consumed');
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_included_delivery(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_consume_included_delivery(uuid, uuid, numeric) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Harden register_hub_storage_arrival + departed_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.hub_storage_tracking
  ADD COLUMN IF NOT EXISTS departed_at timestamptz;

COMMENT ON COLUMN public.hub_storage_tracking.departed_at IS
  'When set, hub storage accrual stops (goods left hub).';

CREATE OR REPLACE FUNCTION public.register_hub_storage_arrival(
  p_store_id uuid,
  p_actor_type text,
  p_weight_kg numeric,
  p_product_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_is_restock boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_free_days int;
  v_rate numeric;
  v_free_until timestamptz;
  v_uid uuid := auth.uid();
  v_ok boolean := false;
  v_restock boolean := false;
  v_prior timestamptz;
BEGIN
  IF p_actor_type IS NULL OR p_actor_type NOT IN ('vendor_inventory', 'buyer_order') THEN
    RAISE EXCEPTION 'invalid actor_type' USING ERRCODE = 'P0001';
  END IF;

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'missing store' USING ERRCODE = 'P0001';
  END IF;

  -- service_role / no JWT: allowed (Edge)
  IF v_uid IS NULL THEN
    v_ok := true;
  ELSE
    v_ok :=
      EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p_store_id AND s.owner_id = v_uid)
      OR EXISTS (
        SELECT 1 FROM public.store_collaborators sc
        WHERE sc.store_id = p_store_id AND sc.user_id = v_uid AND sc.status = 'active'
      )
      OR public.has_role(v_uid, 'admin'::app_role)
      OR public.has_role(v_uid, 'manager'::app_role);
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_actor_type = 'buyer_order' THEN
    v_free_days := 21;
    v_rate := 1.00;
    IF p_order_id IS NULL THEN
      RAISE EXCEPTION 'buyer_order requires order_id' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_free_days := 14;
    v_rate := 0.59;
  END IF;

  -- Server-side restock detection: prior tracking departed within 14 days
  IF p_actor_type = 'vendor_inventory' AND p_product_id IS NOT NULL THEN
    SELECT t.departed_at INTO v_prior
    FROM public.hub_storage_tracking t
    WHERE t.store_id = p_store_id
      AND t.product_id = p_product_id
      AND t.departed_at IS NOT NULL
    ORDER BY t.departed_at DESC
    LIMIT 1;
    IF v_prior IS NOT NULL AND v_prior > now() - interval '14 days' THEN
      v_restock := true;
    END IF;
  END IF;
  -- Ignore client p_is_restock unless staff
  IF COALESCE(p_is_restock, false)
     AND (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'manager'::app_role))
  THEN
    v_restock := true;
  END IF;

  IF v_restock THEN
    v_free_until := now() + interval '100 years';
    v_rate := 0;
  ELSE
    v_free_until := now() + make_interval(days => v_free_days);
  END IF;

  INSERT INTO public.hub_storage_tracking (
    store_id, product_id, order_id, actor_type, weight_kg,
    arrived_at, free_until, daily_rate, is_restock, restock_within_free_window
  ) VALUES (
    p_store_id, p_product_id, p_order_id, p_actor_type, COALESCE(p_weight_kg, 0),
    now(), v_free_until, v_rate, v_restock, v_restock
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_hub_storage_arrival(uuid, text, numeric, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_hub_storage_arrival(uuid, text, numeric, uuid, uuid, boolean)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accrue_hub_storage_charges(p_as_of date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_amount numeric;
  v_inserted int := 0;
  v_buyer uuid;
  v_rows int;
BEGIN
  FOR r IN
    SELECT t.*
    FROM public.hub_storage_tracking t
    WHERE t.departed_at IS NULL
      AND t.free_until::date < p_as_of
      AND COALESCE(t.daily_rate, 0) > 0
      AND COALESCE(t.restock_within_free_window, false) = false
  LOOP
    IF r.actor_type = 'buyer_order' THEN
      v_amount := COALESCE(r.daily_rate, 1.00);
    ELSE
      v_amount := ROUND(COALESCE(r.daily_rate, 0) * GREATEST(COALESCE(r.weight_kg, 1), 0.001), 2);
    END IF;

    SELECT o.user_id INTO v_buyer FROM public.orders o WHERE o.id = r.order_id;

    INSERT INTO public.hub_storage_charges (
      tracking_id, store_id, order_id, user_id, charge_date, amount, weight_kg, daily_rate
    ) VALUES (
      r.id, r.store_id, r.order_id, v_buyer, p_as_of, v_amount, r.weight_kg, r.daily_rate
    )
    ON CONFLICT (tracking_id, charge_date) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_inserted := v_inserted + 1;
      UPDATE public.hub_storage_tracking
      SET is_penalty_active = true,
          total_penalty = COALESCE(total_penalty, 0) + v_amount,
          last_penalty_at = now(),
          updated_at = now()
      WHERE id = r.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'charges_inserted', v_inserted, 'as_of', p_as_of);
END;
$$;

REVOKE ALL ON FUNCTION public.accrue_hub_storage_charges(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accrue_hub_storage_charges(date) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) get_store_entitlements: dual-read BEFORE revoke; kill-switch when override false
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

  -- Pricing dual-read BEFORE revoke
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

  -- Admin revokes ALWAYS win
  FOR v_key IN
    SELECT e.feature_key FROM public.store_feature_entitlements e
    WHERE e.store_id = p_store_id AND e.source = 'admin_revoke'
  LOOP
    v_features := v_features || jsonb_build_object(v_key, false);
  END LOOP;

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

-- ---------------------------------------------------------------------------
-- 5) Checkout flags: include addons; revoke wins; shared resolution
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sid uuid;
  v_cod boolean;
  v_off boolean;
  v_wa boolean;
  v_mm boolean;
  v_card boolean;
  v_plan_keys text[];
  v_revoked text[];
BEGIN
  FOREACH sid IN ARRAY COALESCE(p_store_ids, ARRAY[]::uuid[]) LOOP
    SELECT
      COALESCE(o.vendor_mobile_money_enabled, true),
      COALESCE(o.vendor_card_enabled, true),
      o.vendor_cod_enabled,
      o.vendor_off_platform_enabled,
      o.vendor_whatsapp_enabled
    INTO v_mm, v_card, v_cod, v_off, v_wa
    FROM (SELECT sid AS id) s
    LEFT JOIN public.vendor_pricing_overrides o ON o.store_id = s.id;

    SELECT COALESCE(p.included_feature_keys, ARRAY[]::text[])
    INTO v_plan_keys
    FROM public.vendor_subscriptions vs
    JOIN public.vendor_plan_definitions p ON p.slug = CASE
      WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
      ELSE vs.tier::text
    END AND p.is_active
    WHERE vs.store_id = sid;

    IF v_plan_keys IS NULL THEN v_plan_keys := ARRAY[]::text[]; END IF;

    SELECT COALESCE(array_agg(e.feature_key), ARRAY[]::text[])
    INTO v_revoked
    FROM public.store_feature_entitlements e
    WHERE e.store_id = sid AND e.source = 'admin_revoke';

    -- COD
    v_cod := (
      COALESCE(v_cod, false)
      OR 'cod_payment' = ANY (v_plan_keys)
      OR EXISTS (
        SELECT 1 FROM public.store_feature_entitlements e
        WHERE e.store_id = sid AND e.feature_key = 'cod_payment'
          AND e.source IN ('admin_grant', 'addon') AND e.enabled
          AND (e.paid_until IS NULL OR e.paid_until > now())
      )
    ) AND NOT ('cod_payment' = ANY (v_revoked));

    -- Off-platform
    v_off := (
      COALESCE(v_off, false)
      OR 'off_platform_payment' = ANY (v_plan_keys)
      OR EXISTS (
        SELECT 1 FROM public.store_feature_entitlements e
        WHERE e.store_id = sid AND e.feature_key = 'off_platform_payment'
          AND e.source IN ('admin_grant', 'addon') AND e.enabled
          AND (e.paid_until IS NULL OR e.paid_until > now())
      )
    ) AND NOT ('off_platform_payment' = ANY (v_revoked));

    -- WhatsApp: explicit override false kills; else plan/grant/addon/sub
    IF v_wa IS FALSE THEN
      v_wa := false;
    ELSE
      v_wa := (
        COALESCE(v_wa, false)
        OR 'whatsapp_store' = ANY (v_plan_keys)
        OR EXISTS (
          SELECT 1 FROM public.store_feature_entitlements e
          WHERE e.store_id = sid AND e.feature_key = 'whatsapp_store'
            AND e.source IN ('admin_grant', 'addon') AND e.enabled
            AND (e.paid_until IS NULL OR e.paid_until > now())
        )
        OR EXISTS (
          SELECT 1 FROM public.vendor_subscriptions vs
          WHERE vs.store_id = sid AND COALESCE(vs.is_whatsapp_enabled, false)
        )
      ) AND NOT ('whatsapp_store' = ANY (v_revoked));
    END IF;

    store_id := sid;
    vendor_cod_enabled := COALESCE(v_cod, false);
    vendor_off_platform_enabled := COALESCE(v_off, false);
    vendor_mobile_money_enabled := COALESCE(v_mm, true);
    vendor_card_enabled := COALESCE(v_card, true);
    vendor_whatsapp_enabled := COALESCE(v_wa, false);
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Local shop: resolve inherit → store default_commercial_scope
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_local_store_product_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop text;
  v_default_scope text;
  v_effective text;
BEGIN
  SELECT s.shop_type, COALESCE(s.default_commercial_scope, 'country')
  INTO v_shop, v_default_scope
  FROM public.stores s WHERE s.id = NEW.store_id;

  IF COALESCE(v_shop, 'international') <> 'local' THEN
    RETURN NEW;
  END IF;

  v_effective := CASE COALESCE(NEW.commercial_scope, 'inherit')
    WHEN 'inherit' THEN v_default_scope
    ELSE NEW.commercial_scope
  END;

  IF v_effective IN ('international', 'custom') THEN
    RAISE EXCEPTION 'Boutique locale: scope produit international interdit'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.origin_country IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = NEW.store_id
      AND s.country_code IS NOT NULL
      AND upper(NEW.origin_country) IS DISTINCT FROM upper(s.country_code)
  ) THEN
    RAISE EXCEPTION 'Boutique locale: origine produit hors pays boutique interdite'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Force fulfillment_lane from geo (ignore client forge when geo present)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_order_fulfillment_lane()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_derived text;
BEGIN
  IF NEW.geo_relation IS NOT NULL THEN
    v_derived := CASE NEW.geo_relation
      WHEN 'same_city' THEN 'last_mile'
      WHEN 'same_country_other_city' THEN 'domestic'
      WHEN 'cross_border' THEN 'freight'
      ELSE NULL
    END;
    IF v_derived IS NOT NULL THEN
      NEW.fulfillment_lane := v_derived;
    END IF;
  ELSIF NEW.fulfillment_lane IS NOT NULL
        AND NEW.fulfillment_lane NOT IN ('last_mile', 'domestic', 'freight') THEN
    NEW.fulfillment_lane := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) Allowlist: intersect product allowlists when multiple products have rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_carrier_allowlist_ids(
  p_store_id uuid,
  p_product_ids uuid[],
  p_carrier_type text,
  p_lane text
)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pid uuid;
  v_set uuid[];
  v_acc uuid[] := NULL;
  v_has_any boolean := false;
  v_store_ids uuid[];
BEGIN
  FOREACH v_pid IN ARRAY COALESCE(p_product_ids, ARRAY[]::uuid[]) LOOP
    SELECT ARRAY_AGG(DISTINCT a.carrier_id) INTO v_set
    FROM public.product_carrier_allowlists a
    WHERE a.enabled
      AND a.carrier_type = p_carrier_type
      AND a.product_id = v_pid
      AND (p_lane IS NULL OR p_lane = ANY (a.lanes));

    IF v_set IS NOT NULL AND array_length(v_set, 1) > 0 THEN
      v_has_any := true;
      IF v_acc IS NULL THEN
        v_acc := v_set;
      ELSE
        SELECT ARRAY_AGG(x) INTO v_acc
        FROM (
          SELECT unnest(v_acc) AS x
          INTERSECT
          SELECT unnest(v_set) AS x
        ) q;
        IF v_acc IS NULL THEN
          RETURN ARRAY[]::uuid[]; -- intersection empty → no carriers
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_has_any THEN
    RETURN COALESCE(v_acc, ARRAY[]::uuid[]);
  END IF;

  SELECT ARRAY_AGG(DISTINCT a.carrier_id) INTO v_store_ids
  FROM public.store_carrier_allowlists a
  WHERE a.enabled
    AND a.carrier_type = p_carrier_type
    AND a.store_id = p_store_id
    AND (p_lane IS NULL OR p_lane = ANY (a.lanes));

  IF v_store_ids IS NOT NULL AND array_length(v_store_ids, 1) > 0 THEN
    RETURN v_store_ids;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_carrier_allowlist_ids(uuid, uuid[], text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9) Expand orders sensitive column guards (buyer cannot forge money columns)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_orders_sensitive_column_guards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_store_team boolean;
  v_is_buyer boolean;
  v_deferred boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_admin :=
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'manager'::app_role);
  v_is_buyer := (NEW.user_id = v_uid);
  v_is_store_team := public.can_access_store_orders(v_uid, NEW.store_id);
  v_deferred := COALESCE(NEW.payment_method, OLD.payment_method) IN ('off_platform', 'whatsapp');

  IF (
    NEW.off_platform_admin_released_at IS DISTINCT FROM OLD.off_platform_admin_released_at
    OR NEW.off_platform_admin_released_by IS DISTINCT FROM OLD.off_platform_admin_released_by
  ) AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Seul un admin peut libérer une commande hors plateforme'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_buyer AND NOT v_is_admin AND NOT v_is_store_team THEN
    IF (
      NEW.off_platform_vendor_verified_at IS DISTINCT FROM OLD.off_platform_vendor_verified_at
      OR NEW.off_platform_vendor_verified_by IS DISTINCT FROM OLD.off_platform_vendor_verified_by
      OR NEW.off_platform_admin_released_at IS DISTINCT FROM OLD.off_platform_admin_released_at
      OR NEW.off_platform_admin_released_by IS DISTINCT FROM OLD.off_platform_admin_released_by
      OR NEW.included_delivery_credit IS DISTINCT FROM OLD.included_delivery_credit
      OR NEW.last_mile_fee IS DISTINCT FROM OLD.last_mile_fee
      OR NEW.fulfillment_lane IS DISTINCT FROM OLD.fulfillment_lane
      OR NEW.total IS DISTINCT FROM OLD.total
      OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
    ) THEN
      RAISE EXCEPTION 'Action non autorisée sur les colonnes financières / lane'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_deferred
       AND OLD.status = 'awaiting_payment'
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered')
    THEN
      RAISE EXCEPTION 'Le client ne peut pas confirmer lui-même un paiement différé'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_is_store_team AND NOT v_is_admin THEN
    IF (
      NEW.off_platform_admin_released_at IS DISTINCT FROM OLD.off_platform_admin_released_at
      OR NEW.off_platform_admin_released_by IS DISTINCT FROM OLD.off_platform_admin_released_by
    ) THEN
      RAISE EXCEPTION 'La libération admin hors plateforme est réservée au staff'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
