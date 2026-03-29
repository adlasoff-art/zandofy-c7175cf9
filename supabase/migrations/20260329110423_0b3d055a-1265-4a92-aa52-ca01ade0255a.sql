
-- ========================================
-- Table suppliers
-- ========================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  agent_name TEXT NOT NULL,
  platform_name TEXT NOT NULL DEFAULT '',
  store_url TEXT,
  direct_contact TEXT,
  email TEXT NOT NULL DEFAULT '',
  seniority TEXT,
  average_processing_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for vendor lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_vendor_id ON public.suppliers(vendor_id);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS: Vendor can see own suppliers
DROP POLICY IF EXISTS "Vendors read own suppliers" ON public.suppliers;
CREATE POLICY "Vendors read own suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (vendor_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- RLS: Vendor can insert own suppliers
DROP POLICY IF EXISTS "Vendors insert own suppliers" ON public.suppliers;
CREATE POLICY "Vendors insert own suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (vendor_id = auth.uid());

-- RLS: Vendor can update own suppliers
DROP POLICY IF EXISTS "Vendors update own suppliers" ON public.suppliers;
CREATE POLICY "Vendors update own suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- RLS: Vendor can delete own suppliers
DROP POLICY IF EXISTS "Vendors delete own suppliers" ON public.suppliers;
CREATE POLICY "Vendors delete own suppliers" ON public.suppliers
  FOR DELETE TO authenticated
  USING (vendor_id = auth.uid());

-- ========================================
-- Add supplier_id FK to products
-- ========================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE public.products ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

-- Updated_at trigger for suppliers
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
