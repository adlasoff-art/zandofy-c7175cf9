
-- Table for real-time rider GPS locations
CREATE TABLE public.rider_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id uuid NOT NULL,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  latitude double precision NOT NULL DEFAULT 0,
  longitude double precision NOT NULL DEFAULT 0,
  heading double precision,
  speed double precision,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one location per rider
CREATE UNIQUE INDEX rider_locations_rider_id_key ON public.rider_locations (rider_id);

-- Index for delivery lookups
CREATE INDEX rider_locations_delivery_id_idx ON public.rider_locations (delivery_id);

-- Enable RLS
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;

-- Riders can upsert their own location
CREATE POLICY "Riders upsert own location" ON public.rider_locations
  FOR ALL USING (rider_id = auth.uid())
  WITH CHECK (rider_id = auth.uid());

-- Staff can read all locations
CREATE POLICY "Staff read all locations" ON public.rider_locations
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Vendors can read locations for their deliveries
CREATE POLICY "Vendors read delivery locations" ON public.rider_locations
  FOR SELECT USING (
    delivery_id IN (
      SELECT d.id FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      JOIN stores s ON s.id = o.store_id
      WHERE s.owner_id = auth.uid()
    )
  );

-- Customers can read location of their delivery rider
CREATE POLICY "Customers read their delivery rider location" ON public.rider_locations
  FOR SELECT USING (
    delivery_id IN (
      SELECT d.id FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      WHERE o.user_id = auth.uid()
    )
  );

-- Add delivery coordinates columns
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_lat double precision;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_lng double precision;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS order_ref text;

-- Enable realtime for rider_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_locations;
