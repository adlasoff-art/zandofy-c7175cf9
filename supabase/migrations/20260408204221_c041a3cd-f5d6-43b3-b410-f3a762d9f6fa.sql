
-- Lot 7: Custom variant values per product (vendor-defined beyond admin defaults)
CREATE TABLE public.product_custom_variant_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type_id UUID NOT NULL REFERENCES public.variant_types(id) ON DELETE CASCADE,
  custom_label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, variant_type_id, custom_label)
);

ALTER TABLE public.product_custom_variant_values ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read custom variant values"
ON public.product_custom_variant_values
FOR SELECT USING (true);

-- Vendor can manage their own product's custom values
CREATE POLICY "Vendor manage own product custom variants"
ON public.product_custom_variant_values
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_id
      AND (s.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.store_collaborators sc
        WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
      ))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_id
      AND (s.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.store_collaborators sc
        WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
      ))
  )
);

-- Admin can also manage
CREATE POLICY "Admin manage custom variant values"
ON public.product_custom_variant_values
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_custom_variant_values_product ON public.product_custom_variant_values (product_id);
