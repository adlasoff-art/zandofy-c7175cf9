
-- Add short_description to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description text;

-- Create tiered pricing table
CREATE TABLE public.product_pricing_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tier_label text NOT NULL,
  min_quantity integer NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read pricing tiers"
ON public.product_pricing_tiers
FOR SELECT
USING (true);

-- Index for fast lookup
CREATE INDEX idx_pricing_tiers_product ON public.product_pricing_tiers(product_id, min_quantity);

-- Insert sample tiers for existing products
INSERT INTO public.product_pricing_tiers (product_id, tier_label, min_quantity, discount_type, discount_value)
SELECT id, 'Base', COALESCE(moq, 1), 'percentage', 0 FROM public.products
UNION ALL
SELECT id, 'Bulk', 100, 'percentage', 5 FROM public.products
UNION ALL
SELECT id, 'Wholesale', 500, 'percentage', 12 FROM public.products
UNION ALL
SELECT id, 'VIP', 1000, 'percentage', 20 FROM public.products;
