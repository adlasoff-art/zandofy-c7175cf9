
-- Lot 3: Table for admin-managed trending products
CREATE TABLE public.trending_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.trending_products ENABLE ROW LEVEL SECURITY;

-- Everyone can read trending products
CREATE POLICY "Anyone can view trending products"
ON public.trending_products FOR SELECT
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage trending products"
ON public.trending_products FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Lot 2: Add gender_target to products for recommendation filtering
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gender_target text DEFAULT 'unisex';

-- Lot 5: Add presence_visible toggle to stores (default true)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS presence_visible boolean NOT NULL DEFAULT true;
