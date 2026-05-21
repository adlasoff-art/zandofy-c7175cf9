-- ============================================================
-- Filtrage strict des transitaires au checkout
-- Règle métier : un transitaire n'est éligible au checkout QUE s'il a
--   1. une route coverage_routes contenant origin_country -> destination_country
--   2. le mode demandé dans supported_modes
--   3. un forwarder_pricing_profiles actif pour la VILLE EXACTE demandée
-- (plus de fallback "city_id IS NULL" qui faisait apparaître des transitaires
--  d'une ville dans une autre ville).
-- ============================================================

-- 1) get_eligible_forwarders_v2 : route + ville stricte
DROP FUNCTION IF EXISTS public.get_eligible_forwarders_v2(text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.get_eligible_forwarders_v2(
  p_origin_country      text,
  p_destination_country text,
  p_destination_city_id uuid,
  p_mode                text
)
RETURNS TABLE (
  forwarder_id        uuid,
  forwarder_name      text,
  forwarder_slug      text,
  logo_url            text,
  is_platform_owned   boolean,
  supported_modes     text[],
  covers_origin_city  boolean,
  origin_cities       text[],
  profile_id          uuid,
  service_class       text,
  transit_min_days    int,
  transit_max_days    int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH oc AS (SELECT UPPER(p_origin_country) AS code),
       dc AS (SELECT UPPER(p_destination_country) AS code)
  SELECT
    f.id,
    f.name,
    f.slug,
    f.logo_url,
    f.is_platform_owned,
    f.supported_modes,
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(f.coverage_routes, '[]'::jsonb)) r
      WHERE UPPER(r->>'origin_country') = (SELECT code FROM oc)
        AND UPPER(r->>'destination_country') = (SELECT code FROM dc)
        AND COALESCE(r->>'origin_city', '') <> ''
    ) AS covers_origin_city,
    ARRAY(
      SELECT DISTINCT r->>'origin_city'
      FROM jsonb_array_elements(COALESCE(f.coverage_routes, '[]'::jsonb)) r
      WHERE UPPER(r->>'origin_country') = (SELECT code FROM oc)
        AND UPPER(r->>'destination_country') = (SELECT code FROM dc)
        AND COALESCE(r->>'origin_city', '') <> ''
    ) AS origin_cities,
    fpp.id           AS profile_id,
    fpp.service_class,
    fpp.transit_min_days,
    fpp.transit_max_days
  FROM public.forwarders f
  JOIN public.forwarder_pricing_profiles fpp
    ON fpp.forwarder_id = f.id
   AND fpp.is_active = true
   AND fpp.country_code = (SELECT code FROM dc)
   AND fpp.mode = p_mode
   -- STRICT : la ville doit être identique. Plus de fallback NULL au checkout.
   AND p_destination_city_id IS NOT NULL
   AND fpp.city_id = p_destination_city_id
  WHERE f.is_active = true
    AND COALESCE(f.status, 'approved') IN ('approved', 'active')
    AND (
      f.supported_modes IS NULL
      OR p_mode = ANY (f.supported_modes)
    )
    -- Doit couvrir explicitement la route origine -> destination
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(f.coverage_routes, '[]'::jsonb)) r
      WHERE UPPER(r->>'origin_country') = (SELECT code FROM oc)
        AND UPPER(r->>'destination_country') = (SELECT code FROM dc)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_eligible_forwarders_v2(text, text, uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_eligible_forwarders_v2 IS
  'Checkout : retourne uniquement les transitaires qui couvrent (origine produit -> destination), supportent le mode demandé, ET ont un profil tarifaire actif pour la VILLE EXACTE demandée. Aucun fallback pays-large.';

-- 2) get_eligible_forwarders (legacy) : même contrainte ville stricte,
--    et plus de carte plateforme greyed-out renvoyée. La plateforme suit
--    désormais les mêmes règles que les autres transitaires.
DROP FUNCTION IF EXISTS public.get_eligible_forwarders(text, uuid, text);

CREATE OR REPLACE FUNCTION public.get_eligible_forwarders(
  p_country text,
  p_city_id uuid,
  p_mode text
)
RETURNS TABLE (
  forwarder_id uuid,
  forwarder_name text,
  forwarder_slug text,
  logo_url text,
  tier text,
  mode text,
  price_multiplier numeric,
  transit_min_days integer,
  transit_max_days integer,
  is_platform_owned boolean,
  has_profile_for_zone boolean,
  unavailable_message text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.slug,
    f.logo_url,
    COALESCE(fpp.service_class, 'standard')::text AS tier,
    fpp.mode::text,
    1::numeric AS price_multiplier,
    fpp.transit_min_days,
    fpp.transit_max_days,
    f.is_platform_owned,
    true AS has_profile_for_zone,
    f.unavailable_message
  FROM public.forwarders f
  INNER JOIN public.forwarder_pricing_profiles fpp ON fpp.forwarder_id = f.id
  WHERE f.is_active = true
    AND fpp.is_active = true
    AND fpp.mode = p_mode
    AND upper(fpp.country_code) = upper(p_country)
    -- STRICT : ville exacte uniquement
    AND p_city_id IS NOT NULL
    AND fpp.city_id = p_city_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_eligible_forwarders(text, uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_eligible_forwarders IS
  'Checkout legacy : ville stricte (city_id = p_city_id). Plus de fallback pays-large. Plus de carte plateforme greyed-out automatique.';