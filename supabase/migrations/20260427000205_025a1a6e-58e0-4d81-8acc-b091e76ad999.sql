DROP VIEW IF EXISTS public.v_geo_coverage_status;

CREATE VIEW public.v_geo_coverage_status
WITH (security_invoker = true) AS
SELECT
  c.country_code,
  EXISTS (SELECT 1 FROM public.provinces p WHERE p.country_code = c.country_code) AS has_provinces,
  EXISTS (SELECT 1 FROM public.cities ci WHERE ci.country_code = c.country_code AND ci.is_active = true) AS has_cities,
  EXISTS (SELECT 1 FROM public.communes co WHERE co.country_code = c.country_code AND co.is_active = true) AS has_communes
FROM (
  SELECT DISTINCT country_code FROM public.cities
  UNION
  SELECT DISTINCT country_code FROM public.provinces
) c;

GRANT SELECT ON public.v_geo_coverage_status TO authenticated, anon;