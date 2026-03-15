
-- Table for customer GPS positions during delivery tracking
CREATE TABLE public.customer_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  latitude double precision NOT NULL DEFAULT 0,
  longitude double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per user+order combo
CREATE UNIQUE INDEX customer_locations_user_order ON public.customer_locations(user_id, order_id);

-- Enable RLS
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;

-- Users can upsert their own location
CREATE POLICY "Users upsert own customer location"
ON public.customer_locations FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Riders can read customer locations for deliveries assigned to them
CREATE POLICY "Riders read customer locations for their deliveries"
ON public.customer_locations FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT d.order_id FROM public.deliveries d WHERE d.rider_id = auth.uid()
  )
  OR order_id IN (
    SELECT o.id FROM public.orders o WHERE o.assigned_rider_id = auth.uid()
  )
);

-- Staff can read all
CREATE POLICY "Staff read all customer locations"
ON public.customer_locations FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_locations;
