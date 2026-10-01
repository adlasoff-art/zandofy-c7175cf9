-- Purpose: Phase C3 — fulfillment_lane on orders + soft backfill from geo_relation;
--          shop_type local cannot publish international-scoped products;
--          shop_type change local→international requires pending admin flag.
-- Risk: medium. Lane nullable first; checkout writes lane; trigger keeps sync with geo.
-- Staging → production: after C2; smoke mixed cart split + local store product gate.
-- Rollback: DROP TRIGGER; keep column (additive).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_lane text
  CHECK (fulfillment_lane IS NULL OR fulfillment_lane IN ('last_mile', 'domestic', 'freight'));

COMMENT ON COLUMN public.orders.fulfillment_lane IS
  'Fulfillment lane: last_mile | domestic | freight. Derived from geo_relation when unset.';

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_lane ON public.orders (fulfillment_lane)
  WHERE fulfillment_lane IS NOT NULL;

-- Soft backfill
UPDATE public.orders
SET fulfillment_lane = CASE geo_relation
  WHEN 'same_city' THEN 'last_mile'
  WHEN 'same_country_other_city' THEN 'domestic'
  WHEN 'cross_border' THEN 'freight'
  ELSE fulfillment_lane
END
WHERE fulfillment_lane IS NULL AND geo_relation IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_order_fulfillment_lane()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.geo_relation IS NOT NULL AND (
    NEW.fulfillment_lane IS NULL
    OR NEW.geo_relation IS DISTINCT FROM OLD.geo_relation
  ) THEN
    NEW.fulfillment_lane := CASE NEW.geo_relation
      WHEN 'same_city' THEN 'last_mile'
      WHEN 'same_country_other_city' THEN 'domestic'
      WHEN 'cross_border' THEN 'freight'
      ELSE NEW.fulfillment_lane
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_fulfillment_lane ON public.orders;
CREATE TRIGGER trg_sync_order_fulfillment_lane
  BEFORE INSERT OR UPDATE OF geo_relation, fulfillment_lane ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_fulfillment_lane();

-- Shop type: pending admin when requesting international upgrade
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS shop_type_change_status text
  CHECK (
    shop_type_change_status IS NULL
    OR shop_type_change_status IN ('none', 'pending_admin', 'approved', 'rejected')
  );

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS pending_shop_type text
  CHECK (pending_shop_type IS NULL OR pending_shop_type IN ('local', 'international'));

COMMENT ON COLUMN public.stores.shop_type_change_status IS
  'When local→international, set pending_admin until admin approves.';

-- Prevent local stores from creating/updating products with international commercial_scope
CREATE OR REPLACE FUNCTION public.enforce_local_store_product_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop text;
BEGIN
  SELECT s.shop_type INTO v_shop FROM public.stores s WHERE s.id = NEW.store_id;
  IF COALESCE(v_shop, 'international') = 'local' THEN
    IF COALESCE(NEW.commercial_scope, 'inherit') IN ('international', 'custom') THEN
      RAISE EXCEPTION 'Boutique locale: scope produit international interdit'
        USING ERRCODE = 'P0001';
    END IF;
    -- Block explicit foreign origin when store is local (origin differs from store country)
    IF NEW.origin_country IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = NEW.store_id
        AND s.country_code IS NOT NULL
        AND upper(NEW.origin_country) IS DISTINCT FROM upper(s.country_code)
    ) THEN
      RAISE EXCEPTION 'Boutique locale: origine produit hors pays boutique interdite'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_local_store_product_scope ON public.products;
CREATE TRIGGER trg_enforce_local_store_product_scope
  BEFORE INSERT OR UPDATE OF commercial_scope, origin_country, store_id ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_local_store_product_scope();

-- Gate shop_type changes: local → international requires pending unless admin
CREATE OR REPLACE FUNCTION public.enforce_shop_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.shop_type IS DISTINCT FROM NEW.shop_type
     AND COALESCE(OLD.shop_type, 'international') = 'local'
     AND NEW.shop_type = 'international'
  THEN
    v_is_admin :=
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role);
    IF NOT v_is_admin THEN
      NEW.pending_shop_type := 'international';
      NEW.shop_type_change_status := 'pending_admin';
      NEW.shop_type := 'local'; -- keep local until admin approves
    ELSE
      NEW.shop_type_change_status := 'approved';
      NEW.pending_shop_type := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_shop_type_change ON public.stores;
CREATE TRIGGER trg_enforce_shop_type_change
  BEFORE UPDATE OF shop_type ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_shop_type_change();
