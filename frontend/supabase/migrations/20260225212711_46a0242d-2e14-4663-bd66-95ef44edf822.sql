
-- Shipments table for shipper dashboard
CREATE TABLE public.shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipper_id uuid NOT NULL,
  awb_bl text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  mode text NOT NULL DEFAULT 'air',
  status text NOT NULL DEFAULT 'loading',
  eta text,
  items_count integer NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shippers read own shipments" ON public.shipments
  FOR SELECT TO authenticated
  USING (shipper_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Shippers insert own shipments" ON public.shipments
  FOR INSERT TO authenticated
  WITH CHECK (shipper_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shippers update own shipments" ON public.shipments
  FOR UPDATE TO authenticated
  USING (shipper_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shippers delete own shipments" ON public.shipments
  FOR DELETE TO authenticated
  USING (shipper_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Deliveries table for rider dashboard
CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  customer_name text NOT NULL,
  customer_phone text,
  address text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  items_count integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  delivered_at timestamp with time zone,
  proof_photo_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders read own deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff insert deliveries" ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR rider_id = auth.uid());

CREATE POLICY "Riders update own deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (rider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff delete deliveries" ON public.deliveries
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
