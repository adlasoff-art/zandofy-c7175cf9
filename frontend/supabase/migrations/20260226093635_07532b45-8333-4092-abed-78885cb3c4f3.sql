
-- Shipping Zones (countries/cities grouped for rate management)
CREATE TABLE public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'country', -- 'country', 'city', 'region'
  country_code text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read shipping zones" ON public.shipping_zones
  FOR SELECT USING (true);

CREATE POLICY "Staff manage shipping zones" ON public.shipping_zones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Shipping Routes with multi-modal pricing
CREATE TABLE public.shipping_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_zone_id uuid NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  destination_zone_id uuid NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  transport_mode text NOT NULL DEFAULT 'air', -- 'air', 'sea', 'road'
  -- Air: price per kg, Sea: price per CBM, Road: fixed or per km
  rate_unit text NOT NULL DEFAULT 'kg', -- 'kg', 'cbm', 'fixed', 'km'
  rate_price numeric NOT NULL DEFAULT 0, -- price per unit in USD
  min_charge numeric NOT NULL DEFAULT 0, -- minimum charge per shipment
  fuel_surcharge_pct numeric NOT NULL DEFAULT 0, -- fuel surcharge percentage
  transit_days_min integer DEFAULT 1,
  transit_days_max integer DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(origin_zone_id, destination_zone_id, transport_mode)
);

ALTER TABLE public.shipping_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active shipping routes" ON public.shipping_routes
  FOR SELECT USING (true);

CREATE POLICY "Staff manage shipping routes" ON public.shipping_routes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Category surcharges (e.g., Dangerous Goods +20%)
CREATE TABLE public.category_surcharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  surcharge_type text NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed'
  surcharge_value numeric NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT 'Standard',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id)
);

ALTER TABLE public.category_surcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read category surcharges" ON public.category_surcharges
  FOR SELECT USING (true);

CREATE POLICY "Staff manage category surcharges" ON public.category_surcharges
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Global shipping defaults
CREATE TABLE public.shipping_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL UNIQUE, -- 'air', 'sea', 'road'
  default_rate numeric NOT NULL DEFAULT 0,
  rate_unit text NOT NULL DEFAULT 'kg',
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read shipping defaults" ON public.shipping_defaults
  FOR SELECT USING (true);

CREATE POLICY "Staff manage shipping defaults" ON public.shipping_defaults
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add weight/dimensions columns to products for shipping calc
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_grams integer,
  ADD COLUMN IF NOT EXISTS length_cm numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric;

-- Trigger for updated_at on shipping_routes
CREATE TRIGGER update_shipping_routes_updated_at
  BEFORE UPDATE ON public.shipping_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
