
-- Create a secure view excluding cost data for public consumption
CREATE OR REPLACE VIEW public.products_public AS
SELECT
  id, store_id, category_id, name, name_fr, sku,
  price, original_price, currency, rating, review_count,
  is_new, is_sale, discount, moq, verified_years,
  origin_country, description, material, style,
  created_at, updated_at, publish_status,
  sales_count, stock_quantity,
  prep_days_min, prep_days_max,
  weight_grams, length_cm, width_cm, height_cm,
  auto_pricing_enabled, model_size, slug,
  short_description, flash_timer_enabled, flash_timer_duration_hours,
  promo_start_date, promo_end_date,
  meta_title, meta_description, seo_keywords,
  review_count_override, sales_count_override, verified_years_override,
  trend_tag_id, care_instructions, season, supplier_id
FROM public.products
WHERE publish_status = 'published';

GRANT SELECT ON public.products_public TO anon, authenticated;
