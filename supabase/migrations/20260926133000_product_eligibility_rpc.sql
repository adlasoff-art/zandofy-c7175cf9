-- Purpose: Eligibility RPCs (single + batch) for product × destination.
-- Tables: products, stores, store/product_shipping_destinations, platform_settings
-- Risk: low — when geo_eligibility_enforced is false, always eligible

CREATE OR REPLACE FUNCTION public.geo_eligibility_is_enforced()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT value FROM public.platform_settings WHERE key = 'geo_eligibility_enforced' LIMIT 1) = 'true'::jsonb
      THEN true
    WHEN (SELECT value->>'enabled' FROM public.platform_settings WHERE key = 'geo_eligibility_enforced' LIMIT 1) = 'true'
      THEN true
    ELSE false
  END;
$$;

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

  -- Relation origin ↔ destination
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
    v_ok := (v_origin_country IS NOT NULL AND v_origin_country = v_country);
    v_matched := 'country';
  ELSIF v_scope = 'international' THEN
    -- Destinations configured?
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
      ELSIF v_dest.mode = 'whole_country' THEN
        v_ok := true;
        v_matched := 'country';
      ELSE
        v_ok := EXISTS (
          SELECT 1 FROM public.store_shipping_destination_cities c
          WHERE c.destination_id = v_dest.id AND c.city_id = p_city_id
        );
        v_matched := 'city';
      END IF;
    ELSE
      -- No destinations: only store country (no implicit export)
      v_ok := (v_origin_country IS NOT NULL AND v_origin_country = v_country);
      v_matched := 'country';
    END IF;
  ELSIF v_scope = 'custom' THEN
    IF EXISTS (
      SELECT 1 FROM public.product_shipping_destinations d
      WHERE d.product_id = p_product_id AND d.active = true AND d.country_code = v_country
    ) THEN
      SELECT d.* INTO v_dest
      FROM public.product_shipping_destinations d
      WHERE d.product_id = p_product_id AND d.active = true AND d.country_code = v_country
      LIMIT 1;
      IF v_dest.mode = 'whole_country' THEN
        v_ok := true;
        v_matched := 'country';
      ELSE
        v_ok := EXISTS (
          SELECT 1 FROM public.product_shipping_destination_cities c
          WHERE c.destination_id = v_dest.id AND c.city_id = p_city_id
        );
        v_matched := 'city';
      END IF;
    ELSE
      v_ok := false;
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

CREATE OR REPLACE FUNCTION public.products_eligible_for_destination(
  p_product_ids uuid[],
  p_country_code text,
  p_city_id uuid DEFAULT NULL
)
RETURNS TABLE (product_id uuid, result jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_product_ids IS NULL OR cardinality(p_product_ids) = 0 THEN
    RETURN;
  END IF;
  FOREACH v_id IN ARRAY p_product_ids
  LOOP
    product_id := v_id;
    result := public.product_eligible_for_destination(v_id, p_country_code, p_city_id);
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.geo_eligibility_is_enforced() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.product_eligible_for_destination(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.products_eligible_for_destination(uuid[], text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geo_eligibility_is_enforced() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_eligible_for_destination(uuid, text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.products_eligible_for_destination(uuid[], text, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.product_eligible_for_destination(uuid, text, uuid) IS
  'Hard geo eligibility when geo_eligibility_enforced; soft always-eligible otherwise.';
