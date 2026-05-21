-- =============================================================
-- LOT 1 : Fondations Fret unifié — Idempotent
-- Sécurisé pour rejeu sans erreur
-- =============================================================

-- ============ 1.A — AÉRIEN : colonnes profils ============
ALTER TABLE public.forwarder_pricing_profiles
  ADD COLUMN IF NOT EXISTS service_class text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS volumetric_divisor integer,
  ADD COLUMN IF NOT EXISTS linked_transporter_user_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_service_class'
      AND conrelid = 'public.forwarder_pricing_profiles'::regclass
  ) THEN
    ALTER TABLE public.forwarder_pricing_profiles
      ADD CONSTRAINT chk_service_class
      CHECK (service_class IN ('standard','express','vip','economy'));
  END IF;
END $$;

-- Backfill divisor par défaut selon mode (6000 air, 5000 express, NULL pour sea/road/rail)
UPDATE public.forwarder_pricing_profiles
SET volumetric_divisor = CASE
  WHEN mode = 'air' AND service_class = 'express' THEN 5000
  WHEN mode = 'air' THEN 6000
  ELSE NULL
END
WHERE volumetric_divisor IS NULL AND mode = 'air';

-- ============ 1.A bis — Unicité élargie (mode × pays × ville × classe) ============
DO $$ BEGIN
  -- Drop ancien index unique si présent
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_fpp_unique'
  ) THEN
    DROP INDEX IF EXISTS public.idx_fpp_unique;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fpp_unique_v2
  ON public.forwarder_pricing_profiles (
    forwarder_id, mode, country_code,
    COALESCE(city_id, '00000000-0000-0000-0000-000000000000'::uuid),
    service_class
  );

-- ============ 1.A ter — Unité paliers volumétriques ============
ALTER TABLE public.forwarder_cbm_tiers
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'cbm';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cbm_tier_unit'
      AND conrelid = 'public.forwarder_cbm_tiers'::regclass
  ) THEN
    ALTER TABLE public.forwarder_cbm_tiers
      ADD CONSTRAINT chk_cbm_tier_unit
      CHECK (unit IN ('cbm','kg'));
  END IF;
END $$;

-- ============ 1.A 4 — Unité paliers pièces (ajout 'kg') ============
DO $$
DECLARE
  v_check text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_check
  FROM pg_constraint
  WHERE conname LIKE '%pricing_unit%check%'
    AND conrelid = 'public.forwarder_piece_tiers'::regclass
  LIMIT 1;

  IF v_check IS NOT NULL AND v_check NOT LIKE '%kg%' THEN
    EXECUTE 'ALTER TABLE public.forwarder_piece_tiers DROP CONSTRAINT ' ||
      (SELECT conname FROM pg_constraint
       WHERE conname LIKE '%pricing_unit%check%'
         AND conrelid = 'public.forwarder_piece_tiers'::regclass LIMIT 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_piece_pricing_unit'
      AND conrelid = 'public.forwarder_piece_tiers'::regclass
  ) THEN
    ALTER TABLE public.forwarder_piece_tiers
      ADD CONSTRAINT chk_piece_pricing_unit
      CHECK (pricing_unit IN ('per_piece','per_kg','per_cbm','flat'));
  END IF;
END $$;

-- ============ 1.B — GÉOGRAPHIE : 26 provinces RDC ============
INSERT INTO public.provinces (name, country_code, is_active)
SELECT v.name, 'CD', true
FROM (VALUES
  ('Kinshasa'),('Kongo-Central'),('Kwilu'),('Kwango'),('Mai-Ndombe'),
  ('Équateur'),('Sud-Ubangi'),('Nord-Ubangi'),('Mongala'),('Tshuapa'),
  ('Tshopo'),('Bas-Uélé'),('Haut-Uélé'),('Ituri'),
  ('Nord-Kivu'),('Sud-Kivu'),('Maniema'),('Sankuru'),
  ('Kasaï'),('Kasaï-Central'),('Kasaï-Oriental'),('Lomami'),
  ('Haut-Lomami'),('Tanganyika'),('Haut-Katanga'),('Lualaba')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.provinces p
  WHERE p.name = v.name AND p.country_code = 'CD'
);

-- Rattachement des 20 villes RDC existantes
UPDATE public.cities c SET province_id = p.id
FROM public.provinces p
WHERE p.country_code = 'CD' AND c.country_code = 'CD' AND c.province_id IS NULL
  AND (
    (c.name='Kinshasa'    AND p.name='Kinshasa')        OR
    (c.name='Lubumbashi'  AND p.name='Haut-Katanga')    OR
    (c.name='Likasi'      AND p.name='Haut-Katanga')    OR
    (c.name='Kasumbalesa' AND p.name='Haut-Katanga')    OR
    (c.name='Kolwezi'     AND p.name='Lualaba')         OR
    (c.name='Goma'        AND p.name='Nord-Kivu')       OR
    (c.name='Beni'        AND p.name='Nord-Kivu')       OR
    (c.name='Bukavu'      AND p.name='Sud-Kivu')        OR
    (c.name='Uvira'       AND p.name='Sud-Kivu')        OR
    (c.name='Kisangani'   AND p.name='Tshopo')          OR
    (c.name='Bunia'       AND p.name='Ituri')           OR
    (c.name='Kalemie'     AND p.name='Tanganyika')      OR
    (c.name='Kananga'     AND p.name='Kasaï-Central')   OR
    (c.name='Mbuji-Mayi'  AND p.name='Kasaï-Oriental')  OR
    (c.name='Tshikapa'    AND p.name='Kasaï')           OR
    (c.name='Mbandaka'    AND p.name='Équateur')        OR
    (c.name='Kikwit'      AND p.name='Kwilu')           OR
    (c.name='Bandundu'    AND p.name='Kwilu')           OR
    (c.name='Matadi'      AND p.name='Kongo-Central')   OR
    (c.name='Boma'        AND p.name='Kongo-Central')
  );

-- Insertion des villes RDC manquantes (~50 villes)
WITH new_cities(name, province_name, lat, lon, pop) AS (
  VALUES
    ('Mbanza-Ngungu','Kongo-Central',-5.2569,14.8642,150000),
    ('Tshela',       'Kongo-Central',-4.9833,12.9333, 80000),
    ('Moanda',       'Kongo-Central',-5.9333,12.3500,150000),
    ('Kasangulu',    'Kongo-Central',-4.5833,15.1833, 60000),
    ('Inkisi',       'Kongo-Central',-5.1500,14.9833, 90000),
    ('Idiofa',       'Kwilu',         -4.9667,19.6167,100000),
    ('Bulungu',      'Kwilu',         -4.5500,18.6167, 50000),
    ('Kenge',        'Kwango',        -4.8000,17.0500, 70000),
    ('Kahemba',      'Kwango',        -7.2833,19.0000, 40000),
    ('Inongo',       'Mai-Ndombe',    -1.9500,18.2667, 50000),
    ('Bolobo',       'Mai-Ndombe',    -2.1667,16.2333, 30000),
    ('Gemena',       'Sud-Ubangi',     3.2500,19.7667,200000),
    ('Zongo',        'Sud-Ubangi',     4.3333,18.5833, 50000),
    ('Gbadolite',    'Nord-Ubangi',    4.2833,21.0167, 60000),
    ('Bumba',        'Mongala',        2.1833,22.4667,100000),
    ('Lisala',       'Mongala',        2.1500,21.5167, 80000),
    ('Boende',       'Tshuapa',       -0.2167,20.8667, 40000),
    ('Buta',         'Bas-Uélé',       2.8000,24.7333, 50000),
    ('Aketi',        'Bas-Uélé',       2.7333,23.7833, 40000),
    ('Isiro',        'Haut-Uélé',      2.7833,27.6167,180000),
    ('Watsa',        'Haut-Uélé',      3.0500,29.5333, 30000),
    ('Aru',          'Ituri',          2.8833,30.8500, 40000),
    ('Mahagi',       'Ituri',          2.3000,30.9833, 80000),
    ('Mongbwalu',    'Ituri',          1.9500,30.0333, 30000),
    ('Butembo',      'Nord-Kivu',     0.1333,29.2833,670000),
    ('Walikale',     'Nord-Kivu',    -1.4167,28.0500, 30000),
    ('Lubero',       'Nord-Kivu',    -0.1500,29.2333, 50000),
    ('Rutshuru',     'Nord-Kivu',    -1.1833,29.4500, 60000),
    ('Kabare',       'Sud-Kivu',     -2.5333,28.7500, 50000),
    ('Kindu',        'Maniema',      -2.9500,25.9333,170000),
    ('Kasongo',      'Maniema',      -4.4500,26.6667, 80000),
    ('Lodja',        'Sankuru',      -3.4833,23.4333, 90000),
    ('Lusambo',      'Sankuru',      -4.9667,23.4333, 60000),
    ('Mwene-Ditu',   'Lomami',       -7.0000,23.4333,200000),
    ('Kabinda',      'Lomami',       -6.1333,24.4833, 50000),
    ('Kamina',       'Haut-Lomami',  -8.7333,25.0000,140000),
    ('Manono',       'Tanganyika',   -7.3000,27.4167, 60000),
    ('Moba',         'Tanganyika',   -7.0500,29.7167, 40000),
    ('Lwiza',        'Tanganyika',   -6.7000,28.5333, 25000),
    ('Sakania',      'Haut-Katanga', -12.7500,28.5500,30000),
    ('Pweto',        'Haut-Katanga', -8.4667,28.9000, 30000),
    ('Dilolo',       'Lualaba',      -10.7000,22.3333,40000),
    ('Mutshatsha',   'Lualaba',       -10.6833,24.4500,30000),
    ('Demba',        'Kasaï-Central', -5.4833,22.2667,40000),
    ('Luebo',        'Kasaï',         -5.3500,21.4167,50000),
    ('Ilebo',        'Kasaï',         -4.3167,20.5833,60000)
)
INSERT INTO public.cities (name, country_code, latitude, longitude, population, province_id, is_active)
SELECT nc.name, 'CD', nc.lat, nc.lon, nc.pop, p.id, true
FROM new_cities nc
JOIN public.provinces p ON p.name = nc.province_name AND p.country_code = 'CD'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cities c
  WHERE c.name = nc.name AND c.country_code = 'CD'
);

-- ============ 1.C — SURCHARGES (table dédiée, montants fixes prioritaires) ============
CREATE TABLE IF NOT EXISTS public.forwarder_surcharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.forwarder_pricing_profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  label text NOT NULL,
  surcharge_type text NOT NULL DEFAULT 'fixed_per_order',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_surcharge_type'
      AND conrelid = 'public.forwarder_surcharges'::regclass
  ) THEN
    ALTER TABLE public.forwarder_surcharges
      ADD CONSTRAINT chk_surcharge_type
      CHECK (surcharge_type IN ('fixed_per_kg','fixed_per_cbm','fixed_per_order','percent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fs_profile ON public.forwarder_surcharges(profile_id, sort_order);

ALTER TABLE public.forwarder_surcharges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forwarder_surcharges' AND policyname='Admins manage surcharges') THEN
    CREATE POLICY "Admins manage surcharges" ON public.forwarder_surcharges
      FOR ALL TO authenticated
      USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
      WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forwarder_surcharges' AND policyname='Public read surcharges of active profiles') THEN
    CREATE POLICY "Public read surcharges of active profiles" ON public.forwarder_surcharges
      FOR SELECT TO public
      USING (EXISTS (
        SELECT 1 FROM public.forwarder_pricing_profiles p
        WHERE p.id = forwarder_surcharges.profile_id AND p.is_active = true
      ));
  END IF;
END $$;

-- ============ 1.D — RÔLE FORWARDER ============
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'forwarder'
      AND enumtypid = 'public.app_role'::regtype
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'forwarder';
  END IF;
END $$;

-- ============ 1.E — VUE PUBLIQUE : recompilation ============
DROP VIEW IF EXISTS public.v_forwarder_profiles_public CASCADE;
CREATE VIEW public.v_forwarder_profiles_public
WITH (security_invoker = true) AS
SELECT
  p.id, p.forwarder_id, p.mode, p.country_code, p.city_id, p.currency,
  p.service_class, p.volumetric_divisor,
  p.transit_min_days, p.transit_max_days,
  p.deposit_pct, p.deposit_threshold_cbm,
  p.notes, p.is_active, p.created_at, p.updated_at
FROM public.forwarder_pricing_profiles p
WHERE p.is_active = true;

GRANT SELECT ON public.v_forwarder_profiles_public TO anon, authenticated;