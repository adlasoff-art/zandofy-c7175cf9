ALTER TABLE public.vendor_pricing_overrides
ADD COLUMN IF NOT EXISTS vendor_cod_enabled boolean NOT NULL DEFAULT false;