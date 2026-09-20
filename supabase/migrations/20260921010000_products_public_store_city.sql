-- Purpose: Expose store city on products_public for discovery I7 true-city matching.
-- Tables/views: products_public (recreate additive columns store_city_id, store_city)
-- Rollback: recreate view without store_city_* (see 20260916160000_mois_ca_audit_harden.sql)
-- Risk: low — nullable columns; V1 seed-partition fallback when null; ~4000 users unaffected

DROP VIEW IF EXISTS public.products_public CASCADE;

CREATE VIEW public.products_public
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.store_id,
  p.category_id,
  p.name,
  p.name_fr,
  p.sku,
  p.slug,
  p.price,
  p.original_price,
  p.currency,
  p.rating,
  p.review_count,
  p.is_new,
  p.is_sale,
  p.discount,
  p.moq,
  p.verified_years,
  p.origin_country,
  p.description,
  p.short_description,
  p.material,
  p.style,
  p.care_instructions,
  p.season,
  p.created_at,
  p.updated_at,
  p.publish_status,
  p.sales_count,
  p.stock_quantity,
  p.prep_days_min,
  p.prep_days_max,
  p.weight_grams,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  p.auto_pricing_enabled,
  p.model_size,
  p.flash_timer_enabled,
  p.flash_timer_duration_hours,
  p.promo_start_date,
  p.promo_end_date,
  p.meta_title,
  p.meta_description,
  p.seo_keywords,
  p.trend_tag_id,
  p.gender_target,
  p.can_ship_air,
  p.can_ship_sea,
  COALESCE(s.shop_type, 'international') AS shop_type,
  COALESCE(s.is_verified, false) AS store_is_verified,
  COALESCE(s.is_certified, false) AS store_is_certified,
  s.city_id AS store_city_id,
  s.city AS store_city
FROM public.products p
JOIN public.stores s ON s.id = p.store_id
WHERE p.publish_status = 'published'
  AND public.store_is_publicly_visible(s);

COMMENT ON VIEW public.products_public IS
  'Public catalog — published + visible stores; shop_type + store_city_id for discovery geo.';

REVOKE ALL ON TABLE public.products_public FROM PUBLIC;
GRANT SELECT ON TABLE public.products_public TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_products_public_no_insert ON public.products_public;
DROP TRIGGER IF EXISTS trg_products_public_no_update ON public.products_public;
DROP TRIGGER IF EXISTS trg_products_public_no_delete ON public.products_public;
CREATE TRIGGER trg_products_public_no_insert
  INSTEAD OF INSERT ON public.products_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_products_public_no_update
  INSTEAD OF UPDATE ON public.products_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_products_public_no_delete
  INSTEAD OF DELETE ON public.products_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
