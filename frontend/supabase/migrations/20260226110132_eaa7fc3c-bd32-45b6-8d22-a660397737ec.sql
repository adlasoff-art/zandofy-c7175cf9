
-- Cities table with coordinates for Haversine distance calculation
CREATE TABLE public.cities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  population BIGINT DEFAULT 0,
  zone_id UUID REFERENCES public.shipping_zones(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_cities_zone_id ON public.cities(zone_id);
CREATE INDEX idx_cities_country_code ON public.cities(country_code);
CREATE INDEX idx_cities_name ON public.cities(name);

-- RLS
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cities" ON public.cities FOR SELECT USING (true);

CREATE POLICY "Staff manage cities" ON public.cities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Haversine distance function in PostgreSQL
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE sql IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT 6371.0 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) *
      cos(radians(lon2) - radians(lon1)) +
      sin(radians(lat1)) * sin(radians(lat2))
    ))
  )
$$;

-- Logistic zones / continents mapping table
CREATE TABLE public.logistic_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  continent TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.logistic_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read logistic zones" ON public.logistic_zones FOR SELECT USING (true);

CREATE POLICY "Staff manage logistic zones" ON public.logistic_zones FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add logistic_zone_id to cities for continent-level grouping
ALTER TABLE public.cities ADD COLUMN logistic_zone_id UUID REFERENCES public.logistic_zones(id) ON DELETE SET NULL;

-- Seed logistic zones
INSERT INTO public.logistic_zones (name, continent) VALUES
  ('Central Africa', 'Africa'),
  ('West Africa', 'Africa'),
  ('East Africa', 'Africa'),
  ('Southern Africa', 'Africa'),
  ('North Africa', 'Africa'),
  ('South China', 'Asia'),
  ('North China', 'Asia'),
  ('Southeast Asia', 'Asia'),
  ('South Asia', 'Asia'),
  ('Middle East', 'Asia'),
  ('Central Asia', 'Asia'),
  ('East Asia', 'Asia'),
  ('Western Europe', 'Europe'),
  ('Eastern Europe', 'Europe'),
  ('Northern Europe', 'Europe'),
  ('Southern Europe', 'Europe'),
  ('North America', 'Americas'),
  ('Central America', 'Americas'),
  ('South America', 'Americas'),
  ('Caribbean', 'Americas'),
  ('Oceania', 'Oceania');
