-- Purpose: Harden Mois du CA W1–W2 after audit (MM expiry, KYB authz, catalog shop_type, server gates).
-- Tables: products_public, vendor_pricing_overrides, products (trigger), store_kyb_gate authz.
-- Risk (~4000+ users): Additive; grandfather existing MM overrides as admin-granted; no DROP of data.
-- Staging → production: run AFTER 20260916140000 + 20260916150000.

-- ---------------------------------------------------------------------------
-- 1) products_public: expose shop_type (avoid fragile PostgREST stores() embed on VIEW)
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
  p.can_ship_sea,
  COALESCE(s.shop_type, 'international') AS shop_type,
  COALESCE(s.is_verified, false) AS store_is_verified,
  COALESCE(s.is_certified, false) AS store_is_certified
FROM public.products p
JOIN public.stores s ON s.id = p.store_id
WHERE p.publish_status = 'published'
  AND public.store_is_publicly_visible(s);

COMMENT ON VIEW public.products_public IS
  'Public catalog — published + visible stores; includes shop_type for Import/Stock local badges.';

REVOKE ALL ON TABLE public.products_public FROM PUBLIC;
GRANT SELECT ON TABLE public.products_public TO anon, authenticated, service_role;

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

-- ---------------------------------------------------------------------------
-- 2) MM admin grandfather vs paid package (expiry-safe checkout)
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS mm_granted_by_admin boolean NOT NULL DEFAULT false;

-- Existing enabled flags = admin grandfather (never auto-expire)
UPDATE public.vendor_pricing_overrides
SET mm_granted_by_admin = true
WHERE vendor_custom_payment_numbers_enabled = true
  AND mm_granted_by_admin = false;

CREATE OR REPLACE FUNCTION public.sync_mm_numbers_from_package()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_active boolean;
BEGIN
  SELECT sp.slug INTO v_slug
  FROM public.service_packages sp
  WHERE sp.id = NEW.package_id;

  IF v_slug IS DISTINCT FROM 'vendor_mm_numbers' THEN
    RETURN NEW;
  END IF;

  v_active := COALESCE(NEW.is_active, false)
    AND (NEW.paid_until IS NULL OR NEW.paid_until > now());

  IF v_active THEN
    INSERT INTO public.vendor_pricing_overrides (
      store_id,
      vendor_custom_payment_numbers_enabled,
      mm_granted_by_admin,
      updated_at
    ) VALUES (
      NEW.store_id,
      true,
      false,
      now()
    )
    ON CONFLICT (store_id) DO UPDATE SET
      vendor_custom_payment_numbers_enabled = true,
      -- Preserve admin grandfather; package only sets flag if not admin-granted
      mm_granted_by_admin = public.vendor_pricing_overrides.mm_granted_by_admin,
      updated_at = now();
    RETURN NEW;
  END IF;

  -- Expired / inactive package: disable ONLY if not admin-grandfathered
  UPDATE public.vendor_pricing_overrides
  SET vendor_custom_payment_numbers_enabled = false,
      updated_at = now()
  WHERE store_id = NEW.store_id
    AND mm_granted_by_admin = false
    AND vendor_custom_payment_numbers_enabled = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mm_numbers_from_package ON public.store_package_subscriptions;
CREATE TRIGGER trg_sync_mm_numbers_from_package
  AFTER INSERT OR UPDATE OF is_active, package_id, paid_until
  ON public.store_package_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_mm_numbers_from_package();

-- ---------------------------------------------------------------------------
-- 3) store_kyb_gate: only owner / collaborator / admin / manager (no GMV leak)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_kyb_gate(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_type text;
  v_platform boolean;
  v_owner uuid;
  v_gmv numeric;
  v_settings jsonb;
  v_threshold numeric;
  v_ratio numeric;
  v_kyb_status text;
  v_required boolean;
  v_blocked boolean;
  v_soft boolean;
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('exempt', true, 'required', false, 'blocked', false, 'soft_warn', false);
  END IF;

  SELECT COALESCE(s.shop_type, 'international'), COALESCE(s.is_platform_owned, false), s.owner_id
    INTO v_shop_type, v_platform, v_owner
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exempt', true, 'required', false, 'blocked', false, 'soft_warn', false);
  END IF;

  -- Authorization: service_role (uid null in some edge contexts) OR owner/collab/admin
  IF v_uid IS NULL THEN
    v_allowed := true; -- service_role / trigger context
  ELSIF public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'manager') THEN
    v_allowed := true;
  ELSIF v_owner = v_uid THEN
    v_allowed := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.store_collaborators sc
    WHERE sc.store_id = p_store_id AND sc.user_id = v_uid AND sc.status = 'active'
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'exempt', true,
      'required', false,
      'blocked', false,
      'soft_warn', false,
      'error', 'forbidden'
    );
  END IF;

  IF v_platform THEN
    RETURN jsonb_build_object(
      'exempt', true,
      'required', false,
      'blocked', false,
      'soft_warn', false,
      'shop_type', v_shop_type,
      'gmv', 0,
      'threshold', 0,
      'kyb_status', null
    );
  END IF;

  SELECT value INTO v_settings
  FROM public.platform_settings
  WHERE key = 'kyb_settings';

  v_settings := COALESCE(v_settings, '{}'::jsonb);
  v_ratio := COALESCE((v_settings->>'soft_warn_ratio')::numeric, 0.8);
  IF v_shop_type = 'local' THEN
    v_threshold := COALESCE((v_settings->>'threshold_local_usd')::numeric, 200);
  ELSE
    v_threshold := COALESCE((v_settings->>'threshold_international_usd')::numeric, 500);
  END IF;

  v_gmv := public.store_delivered_gmv(p_store_id);

  SELECT ks.status INTO v_kyb_status
  FROM public.kyb_submissions ks
  WHERE ks.store_id = p_store_id
  ORDER BY ks.updated_at DESC NULLS LAST, ks.created_at DESC
  LIMIT 1;

  v_required := v_gmv >= v_threshold;
  v_blocked := v_required AND COALESCE(v_kyb_status, '') IS DISTINCT FROM 'approved';
  v_soft := (NOT v_blocked) AND v_gmv >= (v_threshold * v_ratio) AND COALESCE(v_kyb_status, '') IS DISTINCT FROM 'approved';

  RETURN jsonb_build_object(
    'exempt', false,
    'required', v_required,
    'blocked', v_blocked,
    'soft_warn', v_soft,
    'shop_type', v_shop_type,
    'gmv', v_gmv,
    'threshold', v_threshold,
    'kyb_status', v_kyb_status
  );
END;
$$;

-- Restrict GMV helper similarly (still used internally by store_kyb_gate)
REVOKE EXECUTE ON FUNCTION public.store_delivered_gmv(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_delivered_gmv(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.store_kyb_gate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_kyb_gate(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Server-side KYB gate on catalog mutations (insert / promo activation)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_kyb_before_product_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gate jsonb;
  v_store_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  -- Admins/managers can always mutate (moderation / support)
  IF v_uid IS NOT NULL AND (
    public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'manager')
  ) THEN
    RETURN NEW;
  END IF;

  v_store_id := COALESCE(NEW.store_id, OLD.store_id);
  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_gate := public.store_kyb_gate(v_store_id);
  IF NOT COALESCE((v_gate->>'blocked')::boolean, false) THEN
    RETURN NEW;
  END IF;

  -- Allow updates that don't expand catalog / activate promos (e.g. unpublish, stock)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_sale IS DISTINCT FROM OLD.is_sale AND NEW.is_sale = true THEN
      RAISE EXCEPTION 'kyb_required_before_promo'
        USING ERRCODE = '42501',
              HINT = 'KYB required after sales threshold before activating promotions.';
    END IF;
    -- Block publishing new listings while blocked
    IF COALESCE(NEW.publish_status, '') = 'published'
       AND COALESCE(OLD.publish_status, '') IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'kyb_required_before_listing'
        USING ERRCODE = '42501',
              HINT = 'KYB required after sales threshold before publishing products.';
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT: block creating new products while KYB-blocked
  RAISE EXCEPTION 'kyb_required_before_listing'
    USING ERRCODE = '42501',
          HINT = 'KYB required after sales threshold before adding products.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kyb_before_product_write ON public.products;
CREATE TRIGGER trg_enforce_kyb_before_product_write
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_kyb_before_product_write();

COMMENT ON FUNCTION public.enforce_kyb_before_product_write() IS
  'Blocks product INSERT and publish/promo activation when store_kyb_gate.blocked.';
