-- Purpose: Store default commercial scope + destination zones (orthogonal to shop_type).
-- Tables: stores, store_shipping_destinations, store_shipping_destination_cities, platform_settings
-- Rollback: drop new tables/columns (not recommended with live data)
-- Risk: additive; default country/international from shop_type; flag off by default

-- ---------------------------------------------------------------------------
-- 1) stores.default_commercial_scope
-- ---------------------------------------------------------------------------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS default_commercial_scope text;

UPDATE public.stores
SET default_commercial_scope = CASE
  WHEN COALESCE(shop_type, 'international') = 'local' THEN 'country'
  ELSE 'international'
END
WHERE default_commercial_scope IS NULL;

ALTER TABLE public.stores
  ALTER COLUMN default_commercial_scope SET DEFAULT 'country';

UPDATE public.stores
SET default_commercial_scope = 'country'
WHERE default_commercial_scope IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_default_commercial_scope_check'
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_default_commercial_scope_check
      CHECK (default_commercial_scope IN ('city', 'country', 'international'));
  END IF;
END $$;

ALTER TABLE public.stores
  ALTER COLUMN default_commercial_scope SET NOT NULL;

COMMENT ON COLUMN public.stores.default_commercial_scope IS
  'Commercial sell scope default for products (inherit). Distinct from shop_type ops.';

-- ---------------------------------------------------------------------------
-- 2) Destination tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_shipping_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  mode text NOT NULL DEFAULT 'whole_country',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_shipping_destinations_country_check
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT store_shipping_destinations_mode_check
    CHECK (mode IN ('whole_country', 'selected_cities')),
  CONSTRAINT store_shipping_destinations_store_country_unique
    UNIQUE (store_id, country_code)
);

CREATE TABLE IF NOT EXISTS public.store_shipping_destination_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.store_shipping_destinations(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_shipping_destination_cities_unique
    UNIQUE (destination_id, city_id)
);

CREATE INDEX IF NOT EXISTS idx_store_shipping_destinations_store
  ON public.store_shipping_destinations (store_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_store_shipping_destinations_country
  ON public.store_shipping_destinations (country_code)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_store_shipping_destination_cities_city
  ON public.store_shipping_destination_cities (city_id);

ALTER TABLE public.store_shipping_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_shipping_destination_cities ENABLE ROW LEVEL SECURITY;

-- Owner / staff manage destinations
DROP POLICY IF EXISTS "store_owners_manage_shipping_destinations" ON public.store_shipping_destinations;
CREATE POLICY "store_owners_manage_shipping_destinations"
ON public.store_shipping_destinations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

DROP POLICY IF EXISTS "store_owners_manage_shipping_destination_cities" ON public.store_shipping_destination_cities;
CREATE POLICY "store_owners_manage_shipping_destination_cities"
ON public.store_shipping_destination_cities
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.store_shipping_destinations d
    JOIN public.stores s ON s.id = d.store_id
    WHERE d.id = destination_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.store_shipping_destinations d
    JOIN public.stores s ON s.id = d.store_id
    WHERE d.id = destination_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
);

-- Public read for catalogue eligibility (active rows only)
DROP POLICY IF EXISTS "public_read_active_shipping_destinations" ON public.store_shipping_destinations;
CREATE POLICY "public_read_active_shipping_destinations"
ON public.store_shipping_destinations
FOR SELECT TO anon, authenticated
USING (active = true);

DROP POLICY IF EXISTS "public_read_shipping_destination_cities" ON public.store_shipping_destination_cities;
CREATE POLICY "public_read_shipping_destination_cities"
ON public.store_shipping_destination_cities
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_shipping_destinations d
    WHERE d.id = destination_id AND d.active = true
  )
);

-- ---------------------------------------------------------------------------
-- 3) Feature flag (default off)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES ('geo_eligibility_enforced', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
