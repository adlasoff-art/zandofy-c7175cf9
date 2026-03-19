
-- Add pricing columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_real numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost_calc numeric(12,2),
  ADD COLUMN IF NOT EXISTS auto_pricing_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendor_extra_margin numeric(6,2) DEFAULT 0;

-- Seed pricing_defaults in platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES ('pricing_defaults', '{"margin_pct": 15, "multiplier": 3, "max_extra_margin_under_50": 0.50, "max_extra_margin_over_100": 1.00}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Vendor pricing overrides table
CREATE TABLE IF NOT EXISTS public.vendor_pricing_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  max_multiplier numeric(5,2),
  max_extra_margin numeric(6,2),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

ALTER TABLE public.vendor_pricing_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can manage overrides
CREATE POLICY "Admins manage vendor pricing overrides"
ON public.vendor_pricing_overrides
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Vendors can read their own overrides
CREATE POLICY "Vendors read own pricing overrides"
ON public.vendor_pricing_overrides
FOR SELECT
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE owner_id = auth.uid()
    UNION
    SELECT store_id FROM public.store_collaborators WHERE user_id = auth.uid() AND status = 'active'
  )
);
