-- Drop the old restrictive public policy
DROP POLICY IF EXISTS "Public read safe platform settings" ON public.platform_settings;

-- Create a wider public policy covering all keys the frontend reads publicly
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
    'pricing_defaults'
  ]::text[])
  OR (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role))
);