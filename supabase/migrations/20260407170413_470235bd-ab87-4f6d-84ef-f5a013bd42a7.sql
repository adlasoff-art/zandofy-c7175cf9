
-- Create supplier_products table
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  product_url text,
  image_url text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add supplier_product_id to products
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN supplier_product_id uuid REFERENCES public.supplier_products(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- RLS: vendors can select their own supplier products
DROP POLICY IF EXISTS "Vendors can view own supplier products" ON public.supplier_products;
CREATE POLICY "Vendors can view own supplier products"
ON public.supplier_products FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_products.supplier_id
      AND s.vendor_id = auth.uid()
  )
);

-- RLS: vendors can insert supplier products for their own suppliers
DROP POLICY IF EXISTS "Vendors can insert own supplier products" ON public.supplier_products;
CREATE POLICY "Vendors can insert own supplier products"
ON public.supplier_products FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_products.supplier_id
      AND s.vendor_id = auth.uid()
  )
);

-- RLS: vendors can update their own supplier products
DROP POLICY IF EXISTS "Vendors can update own supplier products" ON public.supplier_products;
CREATE POLICY "Vendors can update own supplier products"
ON public.supplier_products FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_products.supplier_id
      AND s.vendor_id = auth.uid()
  )
);

-- RLS: vendors can delete their own supplier products
DROP POLICY IF EXISTS "Vendors can delete own supplier products" ON public.supplier_products;
CREATE POLICY "Vendors can delete own supplier products"
ON public.supplier_products FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_products.supplier_id
      AND s.vendor_id = auth.uid()
  )
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON public.supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_product_id ON public.products(supplier_product_id);
