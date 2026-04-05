
ALTER TABLE public.vendor_pricing_overrides
ADD COLUMN IF NOT EXISTS max_products_override integer DEFAULT NULL;
