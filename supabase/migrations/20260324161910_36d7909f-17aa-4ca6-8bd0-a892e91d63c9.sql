
-- =============================================
-- 16. BUNDLES "Acheter ensemble"
-- =============================================

CREATE TABLE IF NOT EXISTS public.product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 10,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(bundle_id, product_id)
);

ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

-- RLS: public read active bundles
DROP POLICY IF EXISTS "Public read active bundles" ON public.product_bundles;
CREATE POLICY "Public read active bundles" ON public.product_bundles FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin manage bundles" ON public.product_bundles;
CREATE POLICY "Admin manage bundles" ON public.product_bundles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendor manage own bundles" ON public.product_bundles;
CREATE POLICY "Vendor manage own bundles" ON public.product_bundles FOR ALL USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
) WITH CHECK (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
);

-- Bundle items: anyone can read, admin/vendor manage
DROP POLICY IF EXISTS "Public read bundle items" ON public.bundle_items;
CREATE POLICY "Public read bundle items" ON public.bundle_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage bundle items" ON public.bundle_items;
CREATE POLICY "Admin manage bundle items" ON public.bundle_items FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendor manage own bundle items" ON public.bundle_items;
CREATE POLICY "Vendor manage own bundle items" ON public.bundle_items FOR ALL USING (
  bundle_id IN (SELECT id FROM public.product_bundles WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
) WITH CHECK (
  bundle_id IN (SELECT id FROM public.product_bundles WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
);

-- =============================================
-- 18. AFFILIATE LINKS étendus
-- =============================================

CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  label text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  custom_commission_pct numeric,
  clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  revenue_generated numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own affiliate links" ON public.affiliate_links;
CREATE POLICY "Users manage own affiliate links" ON public.affiliate_links FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manage all affiliate links" ON public.affiliate_links;
CREATE POLICY "Admin manage all affiliate links" ON public.affiliate_links FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
