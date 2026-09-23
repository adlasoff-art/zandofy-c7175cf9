-- Purpose: Allow anon/authenticated public SELECT on marketing landing CMS keys
--          (cms_discover, cms_become_vendor_landing) so /discover and /become-vendor
--          can render Admin CMS copy. Extends allowlist from 20260921020000.
-- Tables: public.platform_settings (RLS policy only)
-- Rollback: re-run policy without the two cms_* keys (see 20260921020000)
-- Risk: low — marketing copy only (no secrets); same pattern as branding/seo_config

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
    'payment_gateways',
    'samples_enabled',
    'rfq_enabled',
    'buyer_protection',
    -- Marketing landings (public copy; admin-writable only)
    'cms_discover',
    'cms_become_vendor_landing'
  ]::text[])
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);
