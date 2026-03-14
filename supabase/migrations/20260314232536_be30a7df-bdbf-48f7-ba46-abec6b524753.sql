
-- Add origin_country to shipping_defaults so we can define per-origin default rates
-- e.g. air from CN = $19/kg, air from TR = $15/kg, air (global fallback) = NULL

ALTER TABLE public.shipping_defaults
  ADD COLUMN IF NOT EXISTS origin_country TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS label TEXT DEFAULT NULL;

-- Drop the old unique constraint on mode (if any) and add a new one on (mode, origin_country)
-- This allows multiple defaults per mode, differentiated by origin country
CREATE UNIQUE INDEX IF NOT EXISTS shipping_defaults_mode_origin_uniq
  ON public.shipping_defaults (mode, COALESCE(origin_country, '__global__'));

COMMENT ON COLUMN public.shipping_defaults.origin_country IS 'ISO country code (e.g. CN, TR, AE). NULL = global fallback for this mode.';
COMMENT ON COLUMN public.shipping_defaults.label IS 'Human-readable label, e.g. "Aérien Chine", "Maritime Dubaï"';
