
-- Table for vendor cancellation requests requiring admin approval
CREATE TABLE public.cancellation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  requested_by UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Store owners can create and read their own requests
CREATE POLICY "Store owners create cancellation requests"
ON public.cancellation_requests FOR INSERT
WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners read own cancellation requests"
ON public.cancellation_requests FOR SELECT
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Staff can manage all cancellation requests
CREATE POLICY "Staff manage cancellation requests"
ON public.cancellation_requests FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Users can read cancellation requests for their own orders
CREATE POLICY "Users read cancellation requests for own orders"
ON public.cancellation_requests FOR SELECT
USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));
