-- Hotfix: restore public supplier/store visibility in production.
--
-- Root cause:
--   public.stores_public was created WITH (security_invoker=on).
--   Since public.stores RLS only allows owner / staff / admin to SELECT,
--   anon and authenticated customers received zero rows from the view,
--   which broke the supplier card on product pages and the /stores page.
--
-- Fix:
--   Recreate public.stores_public WITHOUT security_invoker, so the view
--   runs with the privileges of its (postgres) owner and bypasses the
--   restrictive RLS on stores. The view exposes only safe public columns
--   (no whatsapp_number, no owner_id, no ban/suspension reasons, etc.).
--   Direct SELECT on public.stores stays locked down by RLS.

DROP VIEW IF EXISTS public.stores_public CASCADE;

CREATE VIEW public.stores_public AS
SELECT
  id,
  name,
  slug,
  logo_url,
  banner_url,
  description,
  country,
  city,
  address,
  is_verified,
  is_certified,
  verified_years,
  verified_years_override,
  is_online,
  last_seen_at,
  presence_visible,
  sales_count,
  sales_override,
  followers_count,
  followers_override,
  products_count,
  repurchase_rate,
  sales_trend,
  rating,
  response_rate,
  response_time,
  review_count_override,
  shop_type,
  fulfillment_type,
  is_platform_owned,
  is_banned,
  is_suspended,
  suspended_activities,
  flash_timer_enabled,
  flash_timer_duration_hours,
  chat_media_enabled,
  chat_links_allowed,
  chat_phone_allowed,
  meta_title,
  meta_description,
  seo_keywords,
  default_transit_days_min,
  default_transit_days_max,
  returns_enabled,
  created_at
FROM public.stores;

GRANT SELECT ON public.stores_public TO anon, authenticated;
