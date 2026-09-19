-- Purpose: Make auth_settings readable by anon/authenticated (product toggles, non-secret).
--          Without this, useAuthSettings always falls back to defaults — admin toggles are no-ops.
-- Tables: platform_settings (RLS policy only)
-- Rollback: recreate prior policy without 'auth_settings' (see 20260409100056_…)
-- Risk: low — JSON is UX config only (mode, phone field, onboarding flags); writes stay admin-only

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
    'auth_settings'
  ]::text[])
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);

-- Ensure seed exists even if earlier seed migration was skipped
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'auth_settings',
  jsonb_build_object(
    'mode', 'fluid',
    'collect_phone_on_signup', true,
    'address_onboarding_enabled', true,
    'gate_checkout_on_email_confirm', false
  ),
  now()
)
ON CONFLICT (key) DO NOTHING;
