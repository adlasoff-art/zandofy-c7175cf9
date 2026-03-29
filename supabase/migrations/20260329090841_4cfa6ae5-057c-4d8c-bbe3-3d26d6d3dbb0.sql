
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS prep_days_min integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS prep_days_max integer DEFAULT 5;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS default_transit_days_min integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS default_transit_days_max integer DEFAULT 6;
