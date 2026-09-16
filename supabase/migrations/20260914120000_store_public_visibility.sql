-- Purpose: Hide banned/suspended/archived stores from public catalog views.
-- Tables/views: stores (new cols), store_is_publicly_visible(), stores_public,
--               products_public, stores_seo (bot 410 lookup).
-- Why: Admin ban promised "masqué" but stores_public listed all stores;
--      products_public ignored store status.
-- Rollback: DROP FUNCTION store_is_publicly_visible; recreate prior views from
--           20260424012442 + 20260808190000; DROP VIEW stores_seo;
--           columns deleted_* can remain (nullable, unused).
-- Risk (~4000+ users): Low — additive columns; catalog shrinks only for
--           non-public stores. Orders/admin still use base table stores.
-- Staging → production: run this file in SQL Editor, then deploy frontend.

-- ---------------------------------------------------------------------------
-- 1) Soft-archive columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

COMMENT ON COLUMN public.stores.deleted_at IS
  'Soft-archive: when set, store is hidden from public catalog (recoverable).';

CREATE INDEX IF NOT EXISTS idx_stores_public_visibility
  ON public.stores (is_banned, is_suspended)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Visibility helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_is_publicly_visible(s public.stores)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NOT coalesce(s.is_banned, false)
     AND NOT coalesce(s.is_suspended, false)
     AND s.deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.store_is_publicly_visible(public.stores) IS
  'True when store may appear on public catalog (stores_public / products_public).';

GRANT EXECUTE ON FUNCTION public.store_is_publicly_visible(public.stores) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) stores_public — catalog only (exclude ban / suspend / archive)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.stores_public CASCADE;

CREATE VIEW public.stores_public
WITH (security_invoker = false) AS
SELECT
  id, name, slug, logo_url, banner_url, description,
  country, city, address,
  is_verified, is_certified,
  verified_years, verified_years_override,
  is_online, last_seen_at, presence_visible,
  sales_count, sales_override,
  followers_count, followers_override,
  products_count, repurchase_rate, sales_trend,
  rating, response_rate, response_time,
  review_count_override,
  shop_type, fulfillment_type, is_platform_owned,
  is_banned, is_suspended, suspended_activities,
  flash_timer_enabled, flash_timer_duration_hours,
  chat_media_enabled, chat_links_allowed, chat_phone_allowed,
  meta_title, meta_description, seo_keywords,
  default_transit_days_min, default_transit_days_max,
  returns_enabled,
  created_at
FROM public.stores
WHERE public.store_is_publicly_visible(stores);

COMMENT ON VIEW public.stores_public IS
  'Public store catalog — excludes banned, suspended, and soft-archived stores.';

-- SELECT-only (audit v8): strip write grants that recreate can leave on views.
REVOKE ALL ON TABLE public.stores_public FROM PUBLIC;
REVOKE ALL ON TABLE public.stores_public FROM anon;
REVOKE ALL ON TABLE public.stores_public FROM authenticated;
GRANT SELECT ON TABLE public.stores_public TO anon, authenticated;
GRANT SELECT ON TABLE public.stores_public TO service_role;

-- ---------------------------------------------------------------------------
-- 4) stores_seo — includes non-public rows for crawler 410 (no ban_reason)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.stores_seo CASCADE;

CREATE VIEW public.stores_seo
WITH (security_invoker = false) AS
SELECT
  id, name, slug, logo_url, banner_url, description,
  city, country, rating, review_count_override,
  meta_title, meta_description, seo_keywords,
  is_banned, is_suspended, deleted_at
FROM public.stores;

COMMENT ON VIEW public.stores_seo IS
  'SEO/bot lookup including banned/suspended/archived stores (for HTTP 410). No ban_reason.';

REVOKE ALL ON TABLE public.stores_seo FROM PUBLIC;
REVOKE ALL ON TABLE public.stores_seo FROM anon;
REVOKE ALL ON TABLE public.stores_seo FROM authenticated;
GRANT SELECT ON TABLE public.stores_seo TO anon, authenticated;
GRANT SELECT ON TABLE public.stores_seo TO service_role;

-- ---------------------------------------------------------------------------
-- 5) products_public — published AND store publicly visible
-- ---------------------------------------------------------------------------
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
  p.can_ship_sea
FROM public.products p
JOIN public.stores s ON s.id = p.store_id
WHERE p.publish_status = 'published'
  AND public.store_is_publicly_visible(s);

COMMENT ON VIEW public.products_public IS
  'Public catalog — published products of publicly visible stores only; excludes cost_*.';

REVOKE ALL ON TABLE public.products_public FROM PUBLIC;
REVOKE ALL ON TABLE public.products_public FROM anon;
REVOKE ALL ON TABLE public.products_public FROM authenticated;
GRANT SELECT ON TABLE public.products_public TO anon, authenticated;
GRANT SELECT ON TABLE public.products_public TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Re-apply read-only INSTEAD OF triggers (dropped with CASCADE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_public_view_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'public catalog views are read-only; mutate base table products/stores with RLS'
    USING ERRCODE = '42501';
END;
$$;

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

DROP TRIGGER IF EXISTS trg_stores_public_no_insert ON public.stores_public;
DROP TRIGGER IF EXISTS trg_stores_public_no_update ON public.stores_public;
DROP TRIGGER IF EXISTS trg_stores_public_no_delete ON public.stores_public;
CREATE TRIGGER trg_stores_public_no_insert
  INSTEAD OF INSERT ON public.stores_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_stores_public_no_update
  INSTEAD OF UPDATE ON public.stores_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_stores_public_no_delete
  INSTEAD OF DELETE ON public.stores_public
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();

DROP TRIGGER IF EXISTS trg_stores_seo_no_insert ON public.stores_seo;
DROP TRIGGER IF EXISTS trg_stores_seo_no_update ON public.stores_seo;
DROP TRIGGER IF EXISTS trg_stores_seo_no_delete ON public.stores_seo;
CREATE TRIGGER trg_stores_seo_no_insert
  INSTEAD OF INSERT ON public.stores_seo
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_stores_seo_no_update
  INSTEAD OF UPDATE ON public.stores_seo
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();
CREATE TRIGGER trg_stores_seo_no_delete
  INSTEAD OF DELETE ON public.stores_seo
  FOR EACH ROW EXECUTE FUNCTION public.reject_public_view_mutation();

-- ---------------------------------------------------------------------------
-- 7) Lock moderation / soft-archive columns for non-admin writers
-- Owners may UPDATE logo/SEO/etc.; they must not clear ban/suspend/archive.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_store_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  v_is_staff :=
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role);

  -- service_role / SQL editor (no JWT): allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_activities IS DISTINCT FROM OLD.suspended_activities
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
     OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
     OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
     OR NEW.delete_reason IS DISTINCT FROM OLD.delete_reason
  THEN
    RAISE EXCEPTION 'store_moderation_columns_locked'
      USING ERRCODE = '42501',
            HINT = 'Only admin/manager may change ban, suspend, or soft-archive fields.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_store_moderation_columns ON public.stores;
CREATE TRIGGER trg_protect_store_moderation_columns
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_store_moderation_columns();

COMMENT ON FUNCTION public.protect_store_moderation_columns() IS
  'Prevents store owners/collaborators from clearing or setting ban/suspend/soft-archive fields.';
