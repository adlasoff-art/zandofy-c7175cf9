-- ============================================================================
-- Migration : Ajout des colonnes géographiques structurées sur public.stores
-- Cible    : Staging ET Production — 100% idempotent et conditionnel
--
-- Sécurité : tout est wrappé dans des DO blocks qui vérifient l'existence des
--            tables countries / cities / communes avant de les référencer.
--            Donc exécutable même si les Zones Géographiques admin ne sont pas
--            encore déployées sur l'environnement.
-- ============================================================================

BEGIN;

-- 1. Colonnes structurées (toujours créées)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS province_id  uuid,
  ADD COLUMN IF NOT EXISTS city_id      uuid,
  ADD COLUMN IF NOT EXISTS commune_id   uuid;

-- 2. Foreign keys (uniquement si la table cible existe ET la FK n'existe pas déjà)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='provinces')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_province_id_fkey') THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_province_id_fkey
      FOREIGN KEY (province_id) REFERENCES public.provinces(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cities')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_city_id_fkey') THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_city_id_fkey
      FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='communes')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_commune_id_fkey') THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_commune_id_fkey
      FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Indexes (toujours créés)
CREATE INDEX IF NOT EXISTS idx_stores_country_code ON public.stores (country_code);
CREATE INDEX IF NOT EXISTS idx_stores_city_id      ON public.stores (city_id);
CREATE INDEX IF NOT EXISTS idx_stores_province_id  ON public.stores (province_id);

-- 4. Backfill best-effort, totalement conditionnel à l'existence des tables
DO $$
BEGIN
  -- Resolve country_code from ISO-2 already typed in 'country'
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='countries') THEN
    EXECUTE $sql$
      UPDATE public.stores s
         SET country_code = upper(s.country)
       WHERE s.country_code IS NULL
         AND s.country IS NOT NULL
         AND length(s.country) = 2
         AND EXISTS (SELECT 1 FROM public.countries c WHERE c.code = upper(s.country))
    $sql$;

    -- Resolve country_code from full name
    EXECUTE $sql$
      UPDATE public.stores s
         SET country_code = c.code
        FROM public.countries c
       WHERE s.country_code IS NULL
         AND s.country IS NOT NULL
         AND lower(c.name) = lower(s.country)
    $sql$;
  END IF;

  -- Resolve city_id (and province_id) from city name + country_code
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cities') THEN
    EXECUTE $sql$
      UPDATE public.stores s
         SET city_id = ci.id,
             province_id = COALESCE(s.province_id, ci.province_id)
        FROM public.cities ci
       WHERE s.city_id IS NULL
         AND s.city IS NOT NULL
         AND s.country_code IS NOT NULL
         AND ci.country_code = s.country_code
         AND lower(ci.name) = lower(s.city)
    $sql$;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Vérifications (optionnel)
-- ============================================================================
-- SELECT count(*) FILTER (WHERE country_code IS NOT NULL) AS with_iso,
--        count(*) FILTER (WHERE city_id IS NOT NULL)      AS with_city_id,
--        count(*)                                          AS total
--   FROM public.stores;
