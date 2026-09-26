-- Purpose: Server-side geo eligibility gate on order_items + shipping_city_id + trusted geo_relation.
-- Tables: orders, order_items
-- Risk: additive column; trigger only blocks when geo_eligibility_enforced = true
-- Staging → prod: apply after 20260926135000 / 36000; smoke checkout with flag off then on

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_city_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_shipping_city_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_shipping_city_id_fkey
      FOREIGN KEY (shipping_city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_shipping_city_id
  ON public.orders (shipping_city_id)
  WHERE shipping_city_id IS NOT NULL;

COMMENT ON COLUMN public.orders.shipping_city_id IS
  'Optional cities.id for destination; used by geo eligibility enforcement.';

-- Normalize store origin country to ISO2 when possible
CREATE OR REPLACE FUNCTION public.store_origin_country_code(p_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upper(COALESCE(
    NULLIF(trim(both FROM s.country_code), ''),
    CASE
      WHEN length(trim(both FROM coalesce(s.country, ''))) = 2
        THEN trim(both FROM s.country)
      ELSE NULL
    END
  ))
  FROM public.stores s
  WHERE s.id = p_store_id;
$$;

-- Recompute geo_relation from store ↔ shipping (client value is not trusted)
CREATE OR REPLACE FUNCTION public.orders_set_geo_relation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origin_country text;
  v_origin_city uuid;
  v_dest_country text;
BEGIN
  IF NEW.store_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.store_origin_country_code(NEW.store_id), s.city_id
  INTO v_origin_country, v_origin_city
  FROM public.stores s
  WHERE s.id = NEW.store_id;

  v_dest_country := upper(nullif(trim(both FROM coalesce(NEW.shipping_country, '')), ''));
  IF v_dest_country IS NOT NULL AND v_dest_country !~ '^[A-Z]{2}$' THEN
    v_dest_country := NULL;
  END IF;

  IF v_origin_city IS NOT NULL AND NEW.shipping_city_id IS NOT NULL AND v_origin_city = NEW.shipping_city_id THEN
    NEW.geo_relation := 'same_city';
  ELSIF v_origin_country IS NOT NULL AND v_dest_country IS NOT NULL AND v_origin_country = v_dest_country THEN
    NEW.geo_relation := 'same_country_other_city';
  ELSIF v_dest_country IS NOT NULL THEN
    NEW.geo_relation := 'cross_border';
  END IF;
  -- leave null when destination country unknown (legacy / incomplete)

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_geo_relation ON public.orders;
CREATE TRIGGER trg_orders_set_geo_relation
  BEFORE INSERT OR UPDATE OF store_id, shipping_country, shipping_city_id
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_set_geo_relation();

-- Hard gate: block order_items for ineligible products when flag on
CREATE OR REPLACE FUNCTION public.order_items_enforce_geo_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text;
  v_city uuid;
  v_result jsonb;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.geo_eligibility_is_enforced() THEN
    RETURN NEW;
  END IF;

  SELECT
    upper(nullif(trim(both FROM coalesce(o.shipping_country, '')), '')),
    o.shipping_city_id
  INTO v_country, v_city
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF v_country IS NULL OR v_country !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'GEO_ELIGIBILITY: shipping country required when geo eligibility is enforced'
      USING ERRCODE = 'check_violation';
  END IF;

  v_result := public.product_eligible_for_destination(NEW.product_id, v_country, v_city);

  IF coalesce((v_result->>'eligible')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'GEO_ELIGIBILITY: product % not eligible for destination %', NEW.product_id, v_country
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_enforce_geo_eligibility ON public.order_items;
CREATE TRIGGER trg_order_items_enforce_geo_eligibility
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.order_items_enforce_geo_eligibility();

REVOKE ALL ON FUNCTION public.store_origin_country_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_origin_country_code(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.order_items_enforce_geo_eligibility() IS
  'Blocks order_items insert when geo_eligibility_enforced and product not eligible for order shipping destination.';
