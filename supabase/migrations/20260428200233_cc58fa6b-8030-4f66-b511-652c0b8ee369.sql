BEGIN;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS province_id  uuid,
  ADD COLUMN IF NOT EXISTS city_id      uuid,
  ADD COLUMN IF NOT EXISTS commune_id   uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_province_id_fkey')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='provinces') THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_province_id_fkey
      FOREIGN KEY (province_id) REFERENCES public.provinces(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_city_id_fkey')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cities') THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_city_id_fkey
      FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_commune_id_fkey')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='communes') THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_commune_id_fkey
      FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stores_country_code ON public.stores (country_code);
CREATE INDEX IF NOT EXISTS idx_stores_city_id      ON public.stores (city_id);
CREATE INDEX IF NOT EXISTS idx_stores_province_id  ON public.stores (province_id);

-- Backfill best-effort, conditionnel à l'existence des tables zones géo
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='countries') THEN
    EXECUTE $sql$
      UPDATE public.stores s
         SET country_code = upper(s.country)
        WHERE s.country_code IS NULL
          AND s.country IS NOT NULL
          AND length(s.country) = 2
          AND EXISTS (SELECT 1 FROM public.countries c WHERE c.code = upper(s.country))
    $sql$;
    EXECUTE $sql$
      UPDATE public.stores s
         SET country_code = c.code
        FROM public.countries c
       WHERE s.country_code IS NULL
         AND s.country IS NOT NULL
         AND lower(c.name) = lower(s.country)
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cities') THEN
    EXECUTE $sql$
      UPDATE public.stores s
         SET city_id = ci.id,
             province_id = ci.province_id
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