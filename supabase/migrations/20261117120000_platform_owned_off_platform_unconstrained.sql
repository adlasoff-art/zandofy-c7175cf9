-- Purpose: platform-owned stores bypass off-platform monetization
--          (trial / MM sub / grant) while still requiring mode enabled.
--          Independent vendors unchanged. Bodies match audit_fix (18120000).
-- Risk: additive for is_platform_owned only.
-- Apply order: this file then 20261118120000 (idempotent CREATE OR REPLACE).

-- ─── 1) Access: platform-owned bypass monetization only ─────────
CREATE OR REPLACE FUNCTION public.store_off_platform_numbers_allowed(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trial_days int := 30;
  v_created timestamptz;
  v_is_platform boolean := false;
  v_override record;
  v_sub_ok boolean := false;
  v_mon jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(s.is_platform_owned, false), s.created_at
  INTO v_is_platform, v_created
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF NOT FOUND OR v_created IS NULL THEN
    RETURN false;
  END IF;

  -- Platform-operated: no trial / subscription / grant constraints
  IF v_is_platform THEN
    RETURN true;
  END IF;

  SELECT value INTO v_mon
  FROM public.platform_settings
  WHERE key = 'vendor_monetization';
  IF v_mon IS NOT NULL AND (v_mon->>'off_platform_trial_days') ~ '^[0-9]+$' THEN
    v_trial_days := GREATEST(1, (v_mon->>'off_platform_trial_days')::int);
  END IF;

  SELECT
    vendor_custom_payment_numbers_enabled,
    mm_granted_by_admin,
    vendor_off_platform_enabled
  INTO v_override
  FROM public.vendor_pricing_overrides
  WHERE store_id = p_store_id;

  IF COALESCE(v_override.mm_granted_by_admin, false)
     AND COALESCE(v_override.vendor_custom_payment_numbers_enabled, false) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.store_package_subscriptions sps
    JOIN public.service_packages sp ON sp.id = sps.package_id
    WHERE sps.store_id = p_store_id
      AND sps.is_active = true
      AND sp.slug = 'vendor_mm_numbers'
      AND (sps.paid_until IS NULL OR sps.paid_until > now())
  ) INTO v_sub_ok;
  IF v_sub_ok THEN
    RETURN true;
  END IF;

  IF COALESCE(v_override.vendor_custom_payment_numbers_enabled, false)
     AND v_override.mm_granted_by_admin IS NULL THEN
    RETURN true;
  END IF;

  IF COALESCE(v_override.vendor_off_platform_enabled, false)
     AND v_created + make_interval(days => v_trial_days) > now() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.store_off_platform_numbers_allowed(uuid) IS
  'Off-platform numbers access. Platform-owned: always true (no monetization). Else grant/sub/trial.';

REVOKE ALL ON FUNCTION public.store_off_platform_numbers_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_off_platform_numbers_allowed(uuid) TO anon, authenticated;

-- ─── 2) Numbers: require mode ON; platform may use defaults ─────
CREATE OR REPLACE FUNCTION public.get_checkout_off_platform_numbers(p_store_ids uuid[])
RETURNS TABLE (
  store_id uuid,
  operator text,
  operator_label text,
  phone_number text,
  display_name text,
  sort_order int,
  is_preferred boolean,
  qr_image_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sid uuid;
  v_is_platform boolean;
  v_mode_on boolean;
  v_has_store_nums boolean;
  v_defaults jsonb;
  elem jsonb;
BEGIN
  FOREACH sid IN ARRAY COALESCE(p_store_ids, ARRAY[]::uuid[]) LOOP
    SELECT COALESCE(s.is_platform_owned, false)
    INTO v_is_platform
    FROM public.stores s
    WHERE s.id = sid;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT o.vendor_off_platform_enabled
    INTO v_mode_on
    FROM public.vendor_pricing_overrides o
    WHERE o.store_id = sid;

    -- Mode must be explicitly enabled (override true) OR platform entitlement grant.
    -- Never default-ON: avoids showing off_platform when vendor never opted in.
    v_mode_on := COALESCE(v_mode_on, false)
      OR (
        v_is_platform
        AND EXISTS (
          SELECT 1 FROM public.store_feature_entitlements e
          WHERE e.store_id = sid
            AND e.feature_key = 'off_platform_payment'
            AND e.source IN ('admin_grant', 'addon')
            AND e.enabled
            AND (e.paid_until IS NULL OR e.paid_until > now())
        )
      );

    IF NOT v_mode_on THEN
      CONTINUE;
    END IF;

    IF NOT public.store_off_platform_numbers_allowed(sid) THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.store_payment_numbers n
      WHERE n.store_id = sid
        AND n.is_active = true
        AND nullif(btrim(n.phone_number), '') IS NOT NULL
    ) INTO v_has_store_nums;

    IF v_has_store_nums THEN
      RETURN QUERY
      SELECT
        n.store_id,
        n.operator,
        n.operator_label,
        n.phone_number,
        n.display_name,
        n.sort_order,
        COALESCE(n.is_preferred, false),
        n.qr_image_url
      FROM public.store_payment_numbers n
      WHERE n.store_id = sid
        AND n.is_active = true
        AND nullif(btrim(n.phone_number), '') IS NOT NULL
      ORDER BY n.is_preferred DESC NULLS LAST, n.sort_order ASC;
    ELSIF v_is_platform THEN
      SELECT ps.value->'numbers'
      INTO v_defaults
      FROM public.platform_settings ps
      WHERE ps.key = 'default_payment_numbers';

      IF v_defaults IS NOT NULL AND jsonb_typeof(v_defaults) = 'array' THEN
        FOR elem IN
          SELECT value FROM jsonb_array_elements(v_defaults) AS t(value)
        LOOP
          IF nullif(btrim(COALESCE(elem->>'phone_number', '')), '') IS NULL THEN
            CONTINUE;
          END IF;
          store_id := sid;
          operator := COALESCE(elem->>'operator', 'mobile_money');
          operator_label := COALESCE(elem->>'operator_label', operator);
          phone_number := btrim(elem->>'phone_number');
          display_name := COALESCE(elem->>'display_name', '');
          sort_order := COALESCE(NULLIF(elem->>'sort_order', '')::int, 0);
          is_preferred := false;
          qr_image_url := NULL;
          RETURN NEXT;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_checkout_off_platform_numbers(uuid[]) IS
  'Checkout off-platform numbers. Mode must be on; platform-owned may fall back to defaults.';

REVOKE ALL ON FUNCTION public.get_checkout_off_platform_numbers(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_off_platform_numbers(uuid[]) TO anon, authenticated;

-- ─── 3) Flags: platform skips plan/revoke, still needs enable ───
CREATE OR REPLACE FUNCTION public.get_checkout_vendor_payment_flags(p_store_ids uuid[])
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
  v_is_platform boolean := false;
  v_plan_keys text[];
  v_revoked text[];
  v_store_found boolean;
BEGIN
  FOREACH sid IN ARRAY COALESCE(p_store_ids, ARRAY[]::uuid[]) LOOP
    SELECT COALESCE(s.is_platform_owned, false)
    INTO v_is_platform
    FROM public.stores s
    WHERE s.id = sid;
    v_store_found := FOUND;

    IF NOT v_store_found THEN
      -- Unknown store id: fail closed for deferred modes
      store_id := sid;
      vendor_cod_enabled := false;
      vendor_off_platform_enabled := false;
      vendor_mobile_money_enabled := true;
      vendor_card_enabled := true;
      vendor_whatsapp_enabled := false;
      RETURN NEXT;
      CONTINUE;
    END IF;

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

    IF v_is_platform THEN
      -- Explicit enable (override) OR admin/addon entitlement — no plan, no revoke block
      v_off := COALESCE(v_off, false)
        OR EXISTS (
          SELECT 1 FROM public.store_feature_entitlements e
          WHERE e.store_id = sid
            AND e.feature_key = 'off_platform_payment'
            AND e.source IN ('admin_grant', 'addon')
            AND e.enabled
            AND (e.paid_until IS NULL OR e.paid_until > now())
        );
    ELSE
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
    END IF;

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

COMMENT ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) IS
  'Checkout flags. Platform-owned: off_platform needs enable/entitlement, ignores plan/revoke monetization.';

REVOKE ALL ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) TO anon, authenticated;
