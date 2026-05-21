-- 1) Index GIN sur coverage_routes pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_forwarders_coverage_routes_gin
  ON public.forwarders USING GIN (coverage_routes);

-- 2) Vue : origine effective d'un produit (origine produit > origine boutique)
DROP VIEW IF EXISTS public.v_product_effective_origin CASCADE;
CREATE VIEW public.v_product_effective_origin
WITH (security_invoker = true)
AS
SELECT
  p.id AS product_id,
  p.store_id,
  COALESCE(NULLIF(UPPER(p.origin_country), ''), UPPER(s.country)) AS effective_origin_country
FROM public.products p
LEFT JOIN public.stores s ON s.id = p.store_id;

-- 3) Colonne orders.origin_country (ISO2) pour segmentation par origine
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS origin_country text;

COMMENT ON COLUMN public.orders.origin_country IS
  'ISO2 du pays d''origine effectif des produits de cette commande. Sert au split panier multi-origines + au filtrage du transitaire.';

CREATE INDEX IF NOT EXISTS idx_orders_origin_country
  ON public.orders (origin_country)
  WHERE origin_country IS NOT NULL;

-- 4) RPC : get_eligible_forwarders_v2
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
       dc AS (SELECT UPPER(p_destination_country) AS code),
       dcity AS (
         SELECT name FROM public.cities WHERE id = p_destination_city_id LIMIT 1
       )
  SELECT
    f.id,
    f.name,
    f.slug,
    f.logo_url,
    f.is_platform_owned,
    f.supported_modes,
    -- covers_origin_city = true si une route contient origin_city renseignée pour ce pays
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(f.coverage_routes, '[]'::jsonb)) r
      WHERE UPPER(r->>'origin_country') = (SELECT code FROM oc)
        AND UPPER(r->>'destination_country') = (SELECT code FROM dc)
        AND COALESCE(r->>'origin_city', '') <> ''
    ) AS covers_origin_city,
    -- liste des villes d'origine déclarées par ce transitaire pour ce couple
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
   AND (fpp.city_id IS NULL OR fpp.city_id = p_destination_city_id)
  WHERE f.is_active = true
    AND COALESCE(f.status, 'approved') IN ('approved', 'active')
    -- supporte le mode demandé
    AND (
      f.supported_modes IS NULL
      OR p_mode = ANY (f.supported_modes)
    )
    -- couvre la route origine→destination
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(f.coverage_routes, '[]'::jsonb)) r
      WHERE UPPER(r->>'origin_country') = (SELECT code FROM oc)
        AND UPPER(r->>'destination_country') = (SELECT code FROM dc)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_eligible_forwarders_v2(text, text, uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_eligible_forwarders_v2 IS
  'Retourne les transitaires éligibles pour un couple origine→destination + mode, avec leur profil tarifaire. Utilisé au checkout pour ne proposer que les transitaires couvrant le pays d''origine du produit.';
