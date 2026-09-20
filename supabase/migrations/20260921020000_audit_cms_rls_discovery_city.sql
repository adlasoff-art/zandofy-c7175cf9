-- Purpose: Audit fix — public SELECT allowlist for discovery/I9/gateway CMS keys;
--          require city_id when purchase_scope=city in set_own_discovery_prefs;
--          ensure admins can manage platform_settings.
-- Tables: platform_settings (RLS), profiles via set_own_discovery_prefs
-- Rollback: restore policy from 20260919210000; restore RPC from 20260921011000
-- Risk: low — additive allowlist keys; tighter prefs validation; ~4000 users unaffected

-- ---------------------------------------------------------------------------
-- 1) Public-safe platform_settings keys (extend allowlist)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read safe platform settings" ON public.platform_settings;

CREATE POLICY "Public read safe platform settings"
ON public.platform_settings FOR SELECT TO anon, authenticated
USING (
  key = ANY (ARRAY[
    'footer_config',
    'maintenance_mode',
    'seo_settings',
    'seo_enabled',
    'seo_config',
    'new_product_days',
    'newness_duration_days',
    'free_shipping_threshold',
    'referral_settings',
    'loyalty_settings',
    'kyc_settings',
    'shipping_settings',
    'default_currency',
    'supported_currencies',
    'theme_settings',
    'cookie_consent_settings',
    'cookie_settings',
    'social_links',
    'branding',
    'header_theme',
    'theme_colors',
    'topbar_config',
    'geo_blocked_countries',
    'active_countries',
    'review_bonus',
    'pricing_defaults',
    'auth_settings',
    'payment_methods',
    'gateway_fees',
    'vendor_monetization',
    'default_payment_numbers',
    'max_discount_settings',
    'bulk_discount_tiers',
    'visual_search_enabled',
    'home_delivery_enabled',
    -- Hors-scope / discovery / I9 (non-secret toggles)
    'payment_gateways',
    'samples_enabled',
    'rfq_enabled',
    'buyer_protection'
  ]::text[])
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

-- Admin write (may already exist in prod under another name — IF NOT EXISTS via drop+create)
DROP POLICY IF EXISTS "Admins manage platform_settings" ON public.platform_settings;
CREATE POLICY "Admins manage platform_settings"
ON public.platform_settings
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 2) Prefer city_id when scope=city (I7 consistency with onboarding UI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_own_discovery_prefs(p_prefs jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_audience text;
  v_scope text;
  v_receipt text;
  v_country text;
  v_city_id uuid;
  v_interests jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_clean jsonb;
  v_id text;
  v_pay text;
  v_completed text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_prefs IS NULL OR jsonb_typeof(p_prefs) <> 'object' THEN
    RAISE EXCEPTION 'Invalid discovery_prefs';
  END IF;

  IF octet_length(p_prefs::text) > 8000 THEN
    RAISE EXCEPTION 'discovery_prefs too large';
  END IF;

  v_audience := lower(nullif(trim(both FROM coalesce(p_prefs->>'audience', '')), ''));
  IF v_audience IS NOT NULL AND v_audience NOT IN ('male', 'female', 'both', 'any') THEN
    v_audience := NULL;
  END IF;

  v_scope := lower(nullif(trim(both FROM coalesce(p_prefs->>'purchase_scope', '')), ''));
  IF v_scope IS NOT NULL AND v_scope NOT IN ('city', 'country', 'any_country') THEN
    v_scope := NULL;
  END IF;

  v_receipt := lower(nullif(trim(both FROM coalesce(p_prefs->>'receipt_mode', '')), ''));
  IF v_receipt IS NOT NULL AND v_receipt NOT IN ('home_delivery', 'pickup') THEN
    v_receipt := NULL;
  END IF;

  v_country := upper(nullif(trim(both FROM coalesce(p_prefs->>'country_code', '')), ''));
  IF v_country IS NULL OR v_country !~ '^[A-Z]{2}$' THEN
    v_country := NULL;
  END IF;

  BEGIN
    v_city_id := NULLIF(trim(both FROM coalesce(p_prefs->>'city_id', '')), '')::uuid;
  EXCEPTION WHEN others THEN
    v_city_id := NULL;
  END;

  -- Completed onboarding with city scope must include a city_id
  v_completed := CASE
    WHEN (p_prefs->>'completed_at') ~ '^\d{4}-\d{2}-\d{2}T'
    THEN p_prefs->>'completed_at'
    ELSE NULL
  END;
  IF v_completed IS NOT NULL AND v_scope = 'city' AND v_city_id IS NULL THEN
    RAISE EXCEPTION 'city_id required when purchase_scope is city';
  END IF;

  IF jsonb_typeof(p_prefs->'interest_category_ids') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(p_prefs->'interest_category_ids')
    LOOP
      IF v_id IS NOT NULL
         AND char_length(v_id) > 0
         AND char_length(v_id) <= 64
         AND jsonb_array_length(v_interests) < 5
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(v_interests) AS e(x)
           WHERE e.x = v_id
         )
      THEN
        v_interests := v_interests || to_jsonb(v_id);
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(p_prefs->'payment_prefs') = 'array' THEN
    FOR v_pay IN SELECT jsonb_array_elements_text(p_prefs->'payment_prefs')
    LOOP
      IF v_pay IN ('mobile_money', 'card', 'off_platform', 'later')
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(v_payments) AS e(x)
           WHERE e.x = v_pay
         )
      THEN
        v_payments := v_payments || to_jsonb(v_pay);
      END IF;
    END LOOP;
  END IF;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'version', 1,
    'audience', v_audience,
    'interest_category_ids', v_interests,
    'purchase_scope', v_scope,
    'receipt_mode', v_receipt,
    'payment_prefs', v_payments,
    'country_code', v_country,
    'city_id', v_city_id,
    'completed_at', v_completed,
    'skipped_at', CASE
      WHEN (p_prefs->>'skipped_at') ~ '^\d{4}-\d{2}-\d{2}T'
      THEN p_prefs->>'skipped_at'
      ELSE NULL
    END,
    'updated_at', coalesce(
      CASE
        WHEN (p_prefs->>'updated_at') ~ '^\d{4}-\d{2}-\d{2}T'
        THEN p_prefs->>'updated_at'
        ELSE NULL
      END,
      to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  ));

  UPDATE public.profiles
  SET
    discovery_prefs = v_clean,
    updated_at = now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_audience IN ('male', 'female') THEN
    UPDATE public.profiles
    SET gender = v_audience, updated_at = now()
    WHERE id = v_uid
      AND (gender IS NULL OR btrim(gender) = '');
  END IF;

  RETURN v_clean;
END;
$$;

COMMENT ON FUNCTION public.set_own_discovery_prefs(jsonb) IS
  'Authenticated user writes sanitized discovery_prefs; city scope requires city_id when completed.';

-- ---------------------------------------------------------------------------
-- 3) Gate RFQ inserts on platform flag rfq_enabled
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_rfq_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT value INTO v FROM public.platform_settings WHERE key = 'rfq_enabled';
  IF v IS NULL OR (v->>'enabled') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RFQ is disabled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rfq_enabled ON public.product_rfq_requests;
CREATE TRIGGER trg_rfq_enabled
  BEFORE INSERT ON public.product_rfq_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rfq_enabled();
