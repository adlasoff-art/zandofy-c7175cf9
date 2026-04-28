-- ============================================================================
-- Migration : Ajout des colonnes géographiques structurées sur public.stores
-- Cible    : Production (vpt...yxf) — exécutable manuellement dans le SQL Editor
-- Auteur   : Zandofy / 2026-04-28
--
-- But : permettre à chaque boutique d'avoir un country_code (ISO-2),
--       province_id, city_id, commune_id rattachés aux Zones Géographiques
--       admin (countries / provinces / cities / communes). Sans ces colonnes,
--       le RPC get_eligible_forwarders_v2 ne peut pas matcher l'origine ni la
--       destination, ce qui bloque le checkout transitaires.
--
-- Idempotent : utilise IF NOT EXISTS partout.
-- ============================================================================

BEGIN;

-- 1. Colonnes structurées
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS province_id  uuid,
  ADD COLUMN IF NOT EXISTS city_id      uuid,
  ADD COLUMN IF NOT EXISTS commune_id   uuid;

-- 2. Foreign keys (souples : ON DELETE SET NULL pour ne pas casser une boutique
--    si un admin supprime une zone géo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_province_id_fkey'
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_province_id_fkey
      FOREIGN KEY (province_id) REFERENCES public.provinces(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_city_id_fkey'
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_city_id_fkey
      FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_commune_id_fkey'
  ) THEN
    -- Pas de FK si la table communes n'existe pas encore en prod
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='communes') THEN
      ALTER TABLE public.stores
        ADD CONSTRAINT stores_commune_id_fkey
        FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 3. Indexes utilisés par get_eligible_forwarders_v2 et le matching origine/destination
CREATE INDEX IF NOT EXISTS idx_stores_country_code ON public.stores (country_code);
CREATE INDEX IF NOT EXISTS idx_stores_city_id      ON public.stores (city_id);
CREATE INDEX IF NOT EXISTS idx_stores_province_id  ON public.stores (province_id);

-- 4. Backfill best-effort depuis les colonnes texte legacy (country / city)
--    On résout d'abord le pays (par code ISO ou par nom), puis la ville filtrée
--    par ce pays. Les non-résolus restent NULL — le vendeur devra re-sélectionner
--    via le combobox dans son espace boutique.

-- 4a. country_code : si la colonne text 'country' contient déjà un code ISO-2 valide
UPDATE public.stores s
   SET country_code = upper(s.country)
  WHERE s.country_code IS NULL
    AND s.country IS NOT NULL
    AND length(s.country) = 2
    AND EXISTS (
      SELECT 1 FROM public.countries c WHERE c.code = upper(s.country)
    );

-- 4b. country_code : sinon résolution par nom (FR ou EN)
UPDATE public.stores s
   SET country_code = c.code
  FROM public.countries c
 WHERE s.country_code IS NULL
   AND s.country IS NOT NULL
   AND (
        lower(c.name) = lower(s.country)
     OR lower(coalesce(c.name_en, '')) = lower(s.country)
     OR lower(coalesce(c.name_fr, '')) = lower(s.country)
   );

-- 4c. city_id : matching par nom de ville + country_code résolu
UPDATE public.stores s
   SET city_id = ci.id,
       province_id = ci.province_id
  FROM public.cities ci
 WHERE s.city_id IS NULL
   AND s.city IS NOT NULL
   AND s.country_code IS NOT NULL
   AND ci.country_code = s.country_code
   AND lower(ci.name) = lower(s.city);

COMMIT;

-- ============================================================================
-- Vérifications post-migration (optionnel — à lancer manuellement)
-- ============================================================================
-- SELECT count(*) FILTER (WHERE country_code IS NOT NULL) AS with_iso,
--        count(*) FILTER (WHERE city_id IS NOT NULL)      AS with_city_id,
--        count(*)                                          AS total
--   FROM public.stores;
