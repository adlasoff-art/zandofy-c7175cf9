-- Purpose: orders.geo_relation + saved_addresses.city_id for checkout eligibility.
-- Tables: orders, saved_addresses
-- Risk: additive nullable columns; legacy orders keep null → shop_type fallback

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS geo_relation text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_geo_relation_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_geo_relation_check
      CHECK (
        geo_relation IS NULL
        OR geo_relation IN ('same_city', 'same_country_other_city', 'cross_border')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_geo_relation
  ON public.orders (geo_relation)
  WHERE geo_relation IS NOT NULL;

COMMENT ON COLUMN public.orders.geo_relation IS
  'Computed at order create: same_city | same_country_other_city | cross_border. Null = legacy shop_type flows.';

ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS city_id uuid,
  ADD COLUMN IF NOT EXISTS country_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_addresses_city_id_fkey'
  ) THEN
    ALTER TABLE public.saved_addresses
      ADD CONSTRAINT saved_addresses_city_id_fkey
      FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_addresses_city_id
  ON public.saved_addresses (city_id)
  WHERE city_id IS NOT NULL;
