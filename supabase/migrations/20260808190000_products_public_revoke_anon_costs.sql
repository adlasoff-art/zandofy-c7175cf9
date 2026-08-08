-- Purpose: close anon/public cost leak on public.products (audit v7 F1/F2).
-- Pattern: stores_public — safe-column view + drop public SELECT on base table.
-- Affected: products, products_public.
-- Rollback: restore "Public read published products" policy; GRANT SELECT ON products TO anon;
--           (not recommended). Re-point SPA to products if rolling back app code.
-- Risk (~4000+ users): catalog must read products_public; vendors/admins keep
--           full products access via existing owner/admin RLS policies.
-- Staging → production: run this file in SQL Editor, then deploy frontend that
--           queries products_public for public catalog/meta-injector.

DROP VIEW IF EXISTS public.products_public CASCADE;

CREATE VIEW public.products_public
WITH (security_invoker = false) AS
SELECT
  id,
  store_id,
  category_id,
  name,
  name_fr,
  sku,
  slug,
  price,
  original_price,
  currency,
  rating,
  review_count,
  is_new,
  is_sale,
  discount,
  moq,
  verified_years,
  origin_country,
  description,
  short_description,
  material,
  style,
  care_instructions,
  season,
  created_at,
  updated_at,
  publish_status,
  sales_count,
  stock_quantity,
  prep_days_min,
  prep_days_max,
  weight_grams,
  length_cm,
  width_cm,
  height_cm,
  auto_pricing_enabled,
  model_size,
  flash_timer_enabled,
  flash_timer_duration_hours,
  promo_start_date,
  promo_end_date,
  meta_title,
  meta_description,
  seo_keywords,
  trend_tag_id,
  gender_target,
  can_ship_air,
  can_ship_sea
FROM public.products
WHERE publish_status = 'published';

COMMENT ON VIEW public.products_public IS
  'Public catalog projection — excludes cost_*, supplier_*, moderation_*, *_override.';

GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT SELECT ON public.products_public TO service_role;

-- Remove full-row public SELECT on base table (was leaking cost_real, etc.)
DROP POLICY IF EXISTS "Public read published products" ON public.products;

-- Anon must not SELECT the base table at all (use products_public).
REVOKE ALL ON TABLE public.products FROM anon;
-- Authenticated keeps table SELECT for vendor/admin RLS policies (owner/staff).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;

-- Coupons: ensure anon cannot enumerate codes (audit v7 F3). Validation via RPC only.
DO $$
BEGIN
  IF to_regclass('public.coupons') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.coupons FROM anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupons TO authenticated;
    GRANT ALL ON TABLE public.coupons TO service_role;
  END IF;
END $$;

-- Create RPC if missing (may not have been applied on all environments).
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
RETURNS TABLE (
  code text,
  discount_type text,
  discount_value numeric,
  min_order_amount numeric,
  max_uses integer,
  current_uses integer,
  expires_at timestamptz,
  target_city text,
  target_country text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.code, c.discount_type, c.discount_value, c.min_order_amount,
         c.max_uses, c.current_uses, c.expires_at, c.target_city, c.target_country
  FROM public.coupons c
  WHERE c.code = upper(trim(p_code))
    AND c.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO anon, authenticated;
