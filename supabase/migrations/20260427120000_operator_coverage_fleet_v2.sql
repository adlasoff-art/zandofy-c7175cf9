-- ============================================================
-- Phase 10.2 — Operator coverage (commune/quartier) + fleet vehicles
-- ============================================================

-- 1) delivery_operator_cities : granularité commune/quartier
ALTER TABLE public.delivery_operator_cities
  ADD COLUMN IF NOT EXISTS province_id uuid NULL REFERENCES public.provinces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commune_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS quartier_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_doc_commune_ids
  ON public.delivery_operator_cities USING GIN (commune_ids);

CREATE INDEX IF NOT EXISTS idx_doc_quartier_ids
  ON public.delivery_operator_cities USING GIN (quartier_ids);

CREATE INDEX IF NOT EXISTS idx_doc_province_id
  ON public.delivery_operator_cities (province_id);

-- 2) delivery_operators : flotte détaillée avec plaques
ALTER TABLE public.delivery_operators
  ADD COLUMN IF NOT EXISTS fleet_vehicles jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Trigger de validation des plaques (non vides + uniques par opérateur)
CREATE OR REPLACE FUNCTION public.validate_fleet_vehicles()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v jsonb;
  plate text;
  plates text[] := '{}';
BEGIN
  IF NEW.fleet_vehicles IS NULL OR jsonb_typeof(NEW.fleet_vehicles) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR v IN SELECT * FROM jsonb_array_elements(NEW.fleet_vehicles)
  LOOP
    plate := COALESCE(NULLIF(trim(v->>'plate_number'), ''), NULL);
    IF plate IS NULL THEN
      RAISE EXCEPTION 'Chaque véhicule doit avoir une plaque (plate_number) non vide';
    END IF;
    IF (v->>'type') IS NULL OR length(trim(v->>'type')) = 0 THEN
      RAISE EXCEPTION 'Chaque véhicule doit avoir un type';
    END IF;
    IF plate = ANY(plates) THEN
      RAISE EXCEPTION 'Plaque d''immatriculation dupliquée: %', plate;
    END IF;
    plates := array_append(plates, plate);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fleet_vehicles ON public.delivery_operators;
CREATE TRIGGER trg_validate_fleet_vehicles
  BEFORE INSERT OR UPDATE OF fleet_vehicles ON public.delivery_operators
  FOR EACH ROW EXECUTE FUNCTION public.validate_fleet_vehicles();

-- 3) Vue helper : statut de couverture géo plateforme (security_invoker pour respecter RLS appelant)
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

COMMENT ON COLUMN public.delivery_operator_cities.commune_ids IS 'Communes effectivement desservies par l''opérateur dans cette ville';
COMMENT ON COLUMN public.delivery_operator_cities.quartier_ids IS 'Quartiers spécifiquement desservis (vide = toutes les communes cochées)';
COMMENT ON COLUMN public.delivery_operators.fleet_vehicles IS 'Liste des véhicules: [{type, plate_number, brand?, model?}]';