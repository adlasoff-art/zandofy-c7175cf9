-- Purpose: Destination mode except_cities (« pays sauf ces villes ») + eligibility rules for country scope exclusions.
-- Tables: store_shipping_destinations, product_shipping_destinations; function product_eligible_for_destination
-- Risk: additive CHECK widen; existing whole_country/selected_cities unchanged
-- Staging→prod: apply after 261380; smoke vendor exclude cities CD then checkout to excluded city with flag on

-- Widen mode CHECKs
ALTER TABLE public.store_shipping_destinations
  DROP CONSTRAINT IF EXISTS store_shipping_destinations_mode_check;
ALTER TABLE public.store_shipping_destinations
  ADD CONSTRAINT store_shipping_destinations_mode_check
  CHECK (mode IN ('whole_country', 'selected_cities', 'except_cities'));

ALTER TABLE public.product_shipping_destinations
  DROP CONSTRAINT IF EXISTS product_shipping_destinations_mode_check;
ALTER TABLE public.product_shipping_destinations
  ADD CONSTRAINT product_shipping_destinations_mode_check
  CHECK (mode IN ('whole_country', 'selected_cities', 'except_cities'));

COMMENT ON COLUMN public.store_shipping_destinations.mode IS
  'whole_country | selected_cities (allow-list) | except_cities (deny-list via *_destination_cities)';

-- Shared matcher: city list semantics depend on mode
CREATE OR REPLACE FUNCTION public.geo_destination_city_allowed(
  p_mode text,
  p_destination_id uuid,
  p_city_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_mode = 'whole_country' THEN
    RETURN true;
  END IF;

  IF p_mode = 'selected_cities' THEN
    IF p_city_id IS NULL THEN
      RETURN false;
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.store_shipping_destination_cities c
      WHERE c.destination_id = p_destination_id AND c.city_id = p_city_id
    )
    OR EXISTS (
      SELECT 1 FROM public.product_shipping_destination_cities c
      WHERE c.destination_id = p_destination_id AND c.city_id = p_city_id
    );
  END IF;

  IF p_mode = 'except_cities' THEN
    -- Country-level OK when city unknown (feed); deny only when city is explicitly excluded
    IF p_city_id IS NULL THEN
      RETURN true;
    END IF;
    RETURN NOT (
      EXISTS (
        SELECT 1 FROM public.store_shipping_destination_cities c
        WHERE c.destination_id = p_destination_id AND c.city_id = p_city_id
      )
      OR EXISTS (
        SELECT 1 FROM public.product_shipping_destination_cities c
        WHERE c.destination_id = p_destination_id AND c.city_id = p_city_id
      )
    );
  END IF;

  RETURN false;
END;
$$;

-- Recreate eligibility with except_cities + country-scope optional destination row
CREATE OR REPLACE FUNCTION public.product_eligible_for_destination(
  p_product_id uuid,
  p_country_code text,
  p_city_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enforced boolean := public.geo_eligibility_is_enforced();
  v_country text := upper(nullif(trim(both FROM coalesce(p_country_code, '')), ''));
  v_scope text;
  v_store_id uuid;
  v_origin_country text;
  v_origin_city uuid;
  v_relation text;
  v_matched text;
  v_ok boolean := false;
  v_dest record;
BEGIN
  IF v_country IS NULL OR v_country !~ '^[A-Z]{2}$' THEN
    RETURN jsonb_build_object(
      'eligible', NOT v_enforced,
      'enforced', v_enforced,
      'error', 'invalid_country'
    );
  END IF;

  SELECT
    p.store_id,
    public.product_effective_commercial_scope(p.id),
    upper(COALESCE(
      NULLIF(trim(both FROM s.country_code), ''),
      CASE
        WHEN length(trim(both FROM coalesce(s.country, ''))) = 2
          THEN trim(both FROM s.country)
        ELSE NULL
      END
    )),
    s.city_id
  INTO v_store_id, v_scope, v_origin_country, v_origin_city
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = p_product_id;

  IF v_store_id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'enforced', v_enforced, 'error', 'product_not_found');
  END IF;

  IF v_origin_country = '' THEN
    v_origin_country := NULL;
  END IF;

  IF v_origin_city IS NOT NULL AND p_city_id IS NOT NULL AND v_origin_city = p_city_id THEN
    v_relation := 'same_city';
  ELSIF v_origin_country IS NOT NULL AND v_origin_country = v_country THEN
    v_relation := 'same_country_other_city';
  ELSE
    v_relation := 'cross_border';
  END IF;

  IF NOT v_enforced THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'enforced', false,
      'relation', v_relation,
      'matched_scope', v_scope,
      'origin_country', v_origin_country,
      'origin_city_id', v_origin_city,
      'destination_country', v_country,
      'destination_city_id', p_city_id
    );
  END IF;

  IF v_scope = 'city' THEN
    v_ok := (v_origin_city IS NOT NULL AND p_city_id IS NOT NULL AND v_origin_city = p_city_id);
    v_matched := 'city';

  ELSIF v_scope = 'country' THEN
    IF v_origin_country IS NULL OR v_origin_country <> v_country THEN
      v_ok := false;
      v_matched := 'country';
    ELSE
      -- Optional destination row on home country (exclusions / allow-list)
      SELECT d.* INTO v_dest
      FROM public.store_shipping_destinations d
      WHERE d.store_id = v_store_id AND d.active = true AND d.country_code = v_country
      LIMIT 1;
      IF v_dest.id IS NULL THEN
        v_ok := true;
        v_matched := 'country';
      ELSE
        v_ok := public.geo_destination_city_allowed(v_dest.mode, v_dest.id, p_city_id);
        v_matched := CASE WHEN v_dest.mode = 'whole_country' THEN 'country' ELSE 'city' END;
      END IF;
    END IF;

  ELSIF v_scope = 'international' THEN
    IF EXISTS (
      SELECT 1 FROM public.store_shipping_destinations d
      WHERE d.store_id = v_store_id AND d.active = true
    ) THEN
      SELECT d.* INTO v_dest
      FROM public.store_shipping_destinations d
      WHERE d.store_id = v_store_id AND d.active = true AND d.country_code = v_country
      LIMIT 1;
      IF v_dest.id IS NULL THEN
        v_ok := false;
      ELSE
        v_ok := public.geo_destination_city_allowed(v_dest.mode, v_dest.id, p_city_id);
        v_matched := CASE WHEN v_dest.mode = 'whole_country' THEN 'country' ELSE 'city' END;
      END IF;
    ELSE
      -- No destinations: only store country (no implicit export)
      v_ok := (v_origin_country IS NOT NULL AND v_origin_country = v_country);
      v_matched := 'country';
    END IF;

  ELSIF v_scope = 'custom' THEN
    SELECT d.* INTO v_dest
    FROM public.product_shipping_destinations d
    WHERE d.product_id = p_product_id AND d.active = true AND d.country_code = v_country
    LIMIT 1;
    IF v_dest.id IS NULL THEN
      v_ok := false;
    ELSE
      v_ok := public.geo_destination_city_allowed(v_dest.mode, v_dest.id, p_city_id);
      v_matched := CASE WHEN v_dest.mode = 'whole_country' THEN 'country' ELSE 'city' END;
    END IF;
  ELSE
    v_ok := false;
  END IF;

  RETURN jsonb_build_object(
    'eligible', v_ok,
    'enforced', true,
    'relation', v_relation,
    'matched_scope', COALESCE(v_matched, v_scope),
    'origin_country', v_origin_country,
    'origin_city_id', v_origin_city,
    'destination_country', v_country,
    'destination_city_id', p_city_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.geo_destination_city_allowed(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geo_destination_city_allowed(text, uuid, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.geo_destination_city_allowed(text, uuid, uuid) IS
  'Evaluates whole_country / selected_cities / except_cities against destination city lists.';
