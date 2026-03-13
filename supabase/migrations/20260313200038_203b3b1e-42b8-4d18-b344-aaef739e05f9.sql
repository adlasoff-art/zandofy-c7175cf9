
-- Variant types: admin-managed variant categories (Pointure, Volume, Écran, etc.)
CREATE TABLE public.variant_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT DEFAULT '',
  icon TEXT DEFAULT 'ruler',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.variant_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read variant types" ON public.variant_types
  FOR SELECT USING (true);

CREATE POLICY "Staff manage variant types" ON public.variant_types
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Variant type options: predefined values for each variant type
CREATE TABLE public.variant_type_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_type_id UUID NOT NULL REFERENCES public.variant_types(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.variant_type_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read variant type options" ON public.variant_type_options
  FOR SELECT USING (true);

CREATE POLICY "Staff manage variant type options" ON public.variant_type_options
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Product variant selections: links products to variant type options
CREATE TABLE public.product_variant_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type_id UUID NOT NULL REFERENCES public.variant_types(id) ON DELETE CASCADE,
  variant_option_id UUID NOT NULL REFERENCES public.variant_type_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, variant_option_id)
);

ALTER TABLE public.product_variant_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product variant selections" ON public.product_variant_selections
  FOR SELECT USING (true);

CREATE POLICY "Vendors manage own product variants" ON public.product_variant_selections
  FOR ALL TO authenticated
  USING (
    product_id IN (
      SELECT p.id FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage all product variants" ON public.product_variant_selections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Seed some common variant types
INSERT INTO public.variant_types (name, unit, icon, sort_order) VALUES
  ('Pointure', '', 'footprints', 1),
  ('Volume', 'ml', 'droplets', 2),
  ('Écran', '"', 'monitor', 3),
  ('Poids', 'kg', 'weight', 4),
  ('Capacité', 'Go', 'hard-drive', 5);

-- Seed pointure options
INSERT INTO public.variant_type_options (variant_type_id, label, sort_order)
SELECT vt.id, s.label, s.ord
FROM public.variant_types vt,
LATERAL (VALUES ('35',1),('36',2),('37',3),('38',4),('39',5),('40',6),('41',7),('42',8),('43',9),('44',10),('45',11),('46',12)) AS s(label, ord)
WHERE vt.name = 'Pointure';

-- Seed volume options
INSERT INTO public.variant_type_options (variant_type_id, label, sort_order)
SELECT vt.id, s.label, s.ord
FROM public.variant_types vt,
LATERAL (VALUES ('50ml',1),('100ml',2),('200ml',3),('250ml',4),('500ml',5),('750ml',6),('1L',7),('1.5L',8),('2L',9),('5L',10)) AS s(label, ord)
WHERE vt.name = 'Volume';

-- Seed screen sizes
INSERT INTO public.variant_type_options (variant_type_id, label, sort_order)
SELECT vt.id, s.label, s.ord
FROM public.variant_types vt,
LATERAL (VALUES ('24"',1),('27"',2),('32"',3),('40"',4),('43"',5),('50"',6),('55"',7),('65"',8),('75"',9),('85"',10)) AS s(label, ord)
WHERE vt.name = 'Écran';

-- Seed weight options
INSERT INTO public.variant_type_options (variant_type_id, label, sort_order)
SELECT vt.id, s.label, s.ord
FROM public.variant_types vt,
LATERAL (VALUES ('250g',1),('500g',2),('1kg',3),('2kg',4),('5kg',5),('10kg',6),('25kg',7),('50kg',8)) AS s(label, ord)
WHERE vt.name = 'Poids';

-- Seed capacity options
INSERT INTO public.variant_type_options (variant_type_id, label, sort_order)
SELECT vt.id, s.label, s.ord
FROM public.variant_types vt,
LATERAL (VALUES ('16Go',1),('32Go',2),('64Go',3),('128Go',4),('256Go',5),('512Go',6),('1To',7),('2To',8)) AS s(label, ord)
WHERE vt.name = 'Capacité';
