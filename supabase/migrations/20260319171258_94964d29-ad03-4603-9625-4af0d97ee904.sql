
-- Add per-store pricing control columns to vendor_pricing_overrides
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS vendor_extra_margin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS margin_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS multiplier numeric(5,2);

-- Add comment
COMMENT ON COLUMN public.vendor_pricing_overrides.vendor_extra_margin_enabled IS 'Admin toggle: allows vendor to add extra margin on products';
COMMENT ON COLUMN public.vendor_pricing_overrides.margin_pct IS 'Per-store margin %, null = use global default';
COMMENT ON COLUMN public.vendor_pricing_overrides.multiplier IS 'Per-store multiplier, null = use global default';
