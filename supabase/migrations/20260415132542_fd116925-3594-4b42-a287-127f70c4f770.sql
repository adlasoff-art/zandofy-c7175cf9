
-- Add shipping mode columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS can_ship_air boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_ship_sea boolean NOT NULL DEFAULT false;

-- Add shipping labels toggle to vendor_pricing_overrides
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS shipping_labels_enabled boolean NOT NULL DEFAULT false;
