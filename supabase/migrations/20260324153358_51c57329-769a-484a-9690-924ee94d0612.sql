
-- Flash Sales table
CREATE TABLE IF NOT EXISTS public.flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  flash_price numeric NOT NULL,
  original_price numeric NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  max_quantity int DEFAULT NULL,
  sold_quantity int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read active flash sales" ON public.flash_sales;
  CREATE POLICY "Public read active flash sales" ON public.flash_sales FOR SELECT USING (is_active = true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admin manage flash sales" ON public.flash_sales;
  CREATE POLICY "Admin manage flash sales" ON public.flash_sales FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Add is_verified_purchase column to reviews if not exists
DO $$ BEGIN
  ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_verified_purchase boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
