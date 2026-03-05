
-- Vendor-specific coupons table
CREATE TABLE public.store_coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_amount numeric DEFAULT 0,
  max_uses integer DEFAULT NULL,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, code)
);

-- Enable RLS
ALTER TABLE public.store_coupons ENABLE ROW LEVEL SECURITY;

-- Public can read active store coupons (needed for checkout validation)
CREATE POLICY "Public read active store coupons"
ON public.store_coupons FOR SELECT
USING (is_active = true);

-- Store owners can manage their own coupons
CREATE POLICY "Store owners insert coupons"
ON public.store_coupons FOR INSERT
WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners update coupons"
ON public.store_coupons FOR UPDATE
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners delete coupons"
ON public.store_coupons FOR DELETE
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Store owners can read all their coupons (including inactive)
CREATE POLICY "Store owners read all own coupons"
ON public.store_coupons FOR SELECT
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Staff can manage all coupons
CREATE POLICY "Staff manage store coupons"
ON public.store_coupons FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_store_coupons_updated_at
BEFORE UPDATE ON public.store_coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
