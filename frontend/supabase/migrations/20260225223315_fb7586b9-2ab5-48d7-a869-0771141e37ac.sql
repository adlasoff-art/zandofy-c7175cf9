
-- Public function to track a shipment by AWB/BL number (no auth required)
CREATE OR REPLACE FUNCTION public.track_shipment(p_awb_bl text)
RETURNS TABLE(
  id uuid,
  awb_bl text,
  origin text,
  destination text,
  mode text,
  status text,
  eta text,
  items_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    s.id, s.awb_bl, s.origin, s.destination, s.mode, s.status, 
    s.eta, s.items_count, s.created_at, s.updated_at
  FROM public.shipments s
  WHERE LOWER(s.awb_bl) = LOWER(p_awb_bl)
  LIMIT 1;
$$;

-- Also allow tracking deliveries by order ref
CREATE OR REPLACE FUNCTION public.track_delivery(p_order_ref text)
RETURNS TABLE(
  id uuid,
  status text,
  customer_name text,
  address text,
  delivery_date date,
  delivered_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    d.id, d.status, d.customer_name, d.address, 
    d.delivery_date, d.delivered_at, d.created_at, d.updated_at
  FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id
  WHERE LOWER(o.order_ref) = LOWER(p_order_ref)
  LIMIT 1;
$$;
