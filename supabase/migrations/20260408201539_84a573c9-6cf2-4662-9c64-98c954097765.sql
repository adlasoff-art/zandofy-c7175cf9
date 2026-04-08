-- Add is_active to cities for geographic restriction filtering
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Index for filtering active cities
CREATE INDEX IF NOT EXISTS idx_cities_is_active ON public.cities (is_active) WHERE is_active = true;