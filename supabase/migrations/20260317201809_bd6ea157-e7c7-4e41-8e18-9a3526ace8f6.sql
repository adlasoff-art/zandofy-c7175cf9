
-- =============================================
-- Phase 1: Fix critical RLS policies
-- =============================================

-- S1: push_subscriptions — Remove public SELECT, keep user-scoped only
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.push_subscriptions;

-- S2: products — Restrict public read to published only
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read published products"
  ON public.products FOR SELECT
  USING (publish_status = 'published');

-- Keep admin/manager read access to all products
CREATE POLICY "Admins and managers read all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

-- Keep store owners reading their own products (any status)
CREATE POLICY "Store owners read own products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  );

-- S3: vendor_subscriptions — Restrict public read
DROP POLICY IF EXISTS "Public read vendor subscriptions" ON public.vendor_subscriptions;
CREATE POLICY "Authenticated users read own vendor subscription"
  ON public.vendor_subscriptions FOR SELECT
  TO authenticated
  USING (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- S4: platform_settings — Restrict to safe public keys only
DROP POLICY IF EXISTS "Public read platform settings" ON public.platform_settings;
CREATE POLICY "Public read safe platform settings"
  ON public.platform_settings FOR SELECT
  USING (
    key IN (
      'footer_config', 'maintenance_mode', 'seo_settings', 'seo_enabled',
      'new_product_days', 'free_shipping_threshold', 'referral_settings',
      'loyalty_settings', 'kyc_settings', 'shipping_settings',
      'default_currency', 'supported_currencies', 'theme_settings',
      'cookie_consent_settings', 'social_links'
    )
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
  );
