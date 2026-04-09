
-- 1. STORES: Create a public view hiding sensitive columns
CREATE OR REPLACE VIEW public.stores_public
WITH (security_invoker = on) AS
SELECT id, name, description, logo_url, banner_url, is_verified, is_certified,
       verified_years, followers_count, products_count, sales_count, rating,
       is_online, last_seen_at, created_at, shop_type, presence_visible,
       repurchase_rate, response_rate, response_time, sales_trend,
       followers_override, sales_override, verified_years_override, review_count_override,
       owner_id, is_platform_owned, fulfillment_type, returns_enabled,
       default_transit_days_min, default_transit_days_max
FROM public.stores;

-- 2. STORE PAYMENT NUMBERS: Restrict to owners and staff
DROP POLICY IF EXISTS "Authenticated read active payment numbers" ON public.store_payment_numbers;

CREATE POLICY "Store owners and staff read payment numbers"
ON public.store_payment_numbers FOR SELECT TO authenticated
USING (
  is_active = true
  AND (
    store_id IN (SELECT s.id FROM public.stores s WHERE s.owner_id = auth.uid())
    OR store_id IN (SELECT sc.store_id FROM public.store_collaborators sc WHERE sc.user_id = auth.uid() AND sc.status = 'active')
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);
