
-- 1. Create supplier_platforms table (admin-managed)
CREATE TABLE IF NOT EXISTS public.supplier_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_platforms ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read supplier platforms" ON public.supplier_platforms
  FOR SELECT USING (true);

-- Admin manage
CREATE POLICY "Admins manage supplier platforms" ON public.supplier_platforms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert defaults
INSERT INTO public.supplier_platforms (name, sort_order) VALUES
  ('Alibaba', 1),
  ('AliExpress', 2),
  ('PinDuoDuo', 3),
  ('Taobao', 4),
  ('Shein', 5),
  ('1688', 6)
ON CONFLICT (name) DO NOTHING;

-- 2. Add supplier columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_platform_id uuid REFERENCES public.supplier_platforms(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_link text;

-- 3. Create trigger to auto-create delivery record when rider is assigned
CREATE OR REPLACE FUNCTION public.auto_create_delivery_on_rider_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.assigned_rider_id IS NOT DISTINCT FROM NEW.assigned_rider_id THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_rider_id IS NOT NULL THEN
    -- Create delivery record if none exists for this order
    INSERT INTO public.deliveries (
      rider_id, order_id, order_ref, customer_name, customer_phone,
      address, items_count, amount, status, delivery_date
    )
    SELECT
      NEW.assigned_rider_id,
      NEW.id,
      NEW.order_ref,
      COALESCE(NEW.shipping_first_name || ' ' || NEW.shipping_last_name, 'Client'),
      NEW.shipping_phone,
      COALESCE(NEW.shipping_address, '') || ', ' || COALESCE(NEW.shipping_city, '') || ', ' || COALESCE(NEW.shipping_country, ''),
      (SELECT COUNT(*)::int FROM public.order_items WHERE order_id = NEW.id),
      NEW.total,
      'pending',
      CURRENT_DATE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.deliveries WHERE order_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_delivery ON public.orders;
CREATE TRIGGER trg_auto_create_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_delivery_on_rider_assignment();
