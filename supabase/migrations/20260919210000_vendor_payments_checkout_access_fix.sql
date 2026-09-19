-- Purpose: Audit fix Vague B/C — checkout must read payment mode flags + off-platform
--          numbers without exposing full vendor_pricing_overrides; public settings keys;
--          harden vendor_update_payment_modes.
-- Tables: platform_settings (RLS), RPCs (new), vendor_pricing_overrides (via RPC only)
-- Rollback: DROP FUNCTION get_checkout_*; restore prior platform_settings policy.
-- Risk: low — additive RPCs SECURITY DEFINER with narrow SELECT; no mass data change.

-- ---------------------------------------------------------------------------
-- 1) Public-safe platform_settings keys needed by checkout / vendor finance UI
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
    -- Checkout / monetization (non-secret product toggles)
    'payment_methods',
    'gateway_fees',
    'vendor_monetization',
    'default_payment_numbers',
    'max_discount_settings',
    'bulk_discount_tiers',
    'visual_search_enabled',
    'home_delivery_enabled'
  ]::text[])
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

-- ---------------------------------------------------------------------------
-- 2) Checkout: payment mode flags (narrow columns only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_checkout_vendor_payment_flags(p_store_ids uuid[])
RETURNS TABLE (
  store_id uuid,
  vendor_cod_enabled boolean,
  vendor_off_platform_enabled boolean,
  vendor_mobile_money_enabled boolean,
  vendor_card_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sid.id AS store_id,
    COALESCE(o.vendor_cod_enabled, false) AS vendor_cod_enabled,
    COALESCE(o.vendor_off_platform_enabled, false) AS vendor_off_platform_enabled,
    COALESCE(o.vendor_mobile_money_enabled, true) AS vendor_mobile_money_enabled,
    COALESCE(o.vendor_card_enabled, true) AS vendor_card_enabled
  FROM unnest(COALESCE(p_store_ids, ARRAY[]::uuid[])) AS sid(id)
  LEFT JOIN public.vendor_pricing_overrides o ON o.store_id = sid.id;
$$;

COMMENT ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) IS
  'Checkout-safe payment mode flags per store. Defaults: MoMo/card on, COD/off-platform off.';

REVOKE ALL ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Shared access predicate (grant / subscription / trial) — mirrors frontend
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_off_platform_numbers_allowed(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_days int := 30;
  v_created timestamptz;
  v_override record;
  v_sub_ok boolean := false;
  v_mon jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT value INTO v_mon
  FROM public.platform_settings
  WHERE key = 'vendor_monetization';
  IF v_mon IS NOT NULL AND (v_mon->>'off_platform_trial_days') ~ '^[0-9]+$' THEN
    v_trial_days := GREATEST(1, (v_mon->>'off_platform_trial_days')::int);
  END IF;

  SELECT created_at INTO v_created FROM public.stores WHERE id = p_store_id;
  IF v_created IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    vendor_custom_payment_numbers_enabled,
    mm_granted_by_admin,
    vendor_off_platform_enabled
  INTO v_override
  FROM public.vendor_pricing_overrides
  WHERE store_id = p_store_id;

  -- Admin grant
  IF COALESCE(v_override.mm_granted_by_admin, false)
     AND COALESCE(v_override.vendor_custom_payment_numbers_enabled, false) THEN
    RETURN true;
  END IF;

  -- Active MM package subscription
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

  -- Legacy grandfather (custom numbers, grant flag never set)
  IF COALESCE(v_override.vendor_custom_payment_numbers_enabled, false)
     AND v_override.mm_granted_by_admin IS NULL THEN
    RETURN true;
  END IF;

  -- Trial: off_platform enabled AND store within trial window from created_at
  IF COALESCE(v_override.vendor_off_platform_enabled, false)
     AND v_created + make_interval(days => v_trial_days) > now() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.store_off_platform_numbers_allowed(uuid) IS
  'True if store may expose custom payment numbers (grant / MM sub / trial).';

REVOKE ALL ON FUNCTION public.store_off_platform_numbers_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_off_platform_numbers_allowed(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Checkout: active off-platform numbers (no platform-default mix-in)
-- ---------------------------------------------------------------------------
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.store_id,
    n.operator,
    n.operator_label,
    n.phone_number,
    n.display_name,
    n.sort_order,
    COALESCE(n.is_preferred, false) AS is_preferred,
    n.qr_image_url
  FROM unnest(COALESCE(p_store_ids, ARRAY[]::uuid[])) AS sid(id)
  JOIN public.vendor_pricing_overrides o ON o.store_id = sid.id
  JOIN public.store_payment_numbers n ON n.store_id = sid.id
  WHERE o.vendor_off_platform_enabled = true
    AND public.store_off_platform_numbers_allowed(sid.id)
    AND n.is_active = true
    AND nullif(btrim(n.phone_number), '') IS NOT NULL
  ORDER BY n.is_preferred DESC NULLS LAST, n.sort_order ASC;
$$;

COMMENT ON FUNCTION public.get_checkout_off_platform_numbers(uuid[]) IS
  'Checkout-safe vendor off-platform numbers + QR. Empty if mode off / trial expired / no numbers.';

REVOKE ALL ON FUNCTION public.get_checkout_off_platform_numbers(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_off_platform_numbers(uuid[]) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Harden payment-modes RPC (explicit anon revoke)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.vendor_update_payment_modes(uuid, boolean, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_update_payment_modes(uuid, boolean, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_update_payment_modes(uuid, boolean, boolean, boolean) TO authenticated;
