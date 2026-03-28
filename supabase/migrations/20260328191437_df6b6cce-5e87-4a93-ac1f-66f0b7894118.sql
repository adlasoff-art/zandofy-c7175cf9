
-- =============================================
-- Phase 1: Local shops architecture migration
-- =============================================

-- 1.1 Add shop_type, fulfillment_type, fleet_management to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS shop_type text NOT NULL DEFAULT 'international';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'zandofy_warehouse';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS fleet_management text NOT NULL DEFAULT 'platform';

-- 1.2 Add delivery_option, assigned_driver_id, assigned_driver_name to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_option text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_driver_name text;

-- 1.3 Create local_shipping_rates table
CREATE TABLE IF NOT EXISTS public.local_shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL,
  city text NOT NULL DEFAULT 'Kinshasa',
  country text NOT NULL DEFAULT 'CD',
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  price_per_km numeric(10,2) DEFAULT 0,
  vendor_override_allowed boolean DEFAULT false,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.local_shipping_rates ENABLE ROW LEVEL SECURITY;

-- RLS: public read
DROP POLICY IF EXISTS "Public read local shipping rates" ON public.local_shipping_rates;
CREATE POLICY "Public read local shipping rates"
ON public.local_shipping_rates FOR SELECT TO anon, authenticated
USING (true);

-- RLS: admin/manager write
DROP POLICY IF EXISTS "Admin manage local shipping rates" ON public.local_shipping_rates;
CREATE POLICY "Admin manage local shipping rates"
ON public.local_shipping_rates FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

-- RLS: vendor with own_fleet can manage their own rates
DROP POLICY IF EXISTS "Vendor manage own local shipping rates" ON public.local_shipping_rates;
CREATE POLICY "Vendor manage own local shipping rates"
ON public.local_shipping_rates FOR ALL TO authenticated
USING (
  store_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = local_shipping_rates.store_id
      AND s.owner_id = auth.uid()
      AND s.fleet_management = 'own_fleet'
  )
)
WITH CHECK (
  store_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = local_shipping_rates.store_id
      AND s.owner_id = auth.uid()
      AND s.fleet_management = 'own_fleet'
  )
);

-- 1.4 RLS: drivers can read orders assigned to them
DROP POLICY IF EXISTS "Drivers read assigned orders" ON public.orders;
CREATE POLICY "Drivers read assigned orders"
ON public.orders FOR SELECT TO authenticated
USING (assigned_driver_id = auth.uid());

-- 1.5 Trigger: auto-notify local driver + auto-create delivery
CREATE OR REPLACE FUNCTION public.auto_handle_local_driver_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.assigned_driver_id IS NOT DISTINCT FROM NEW.assigned_driver_id THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_driver_id IS NOT NULL THEN
    -- Notify the driver
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assigned_driver_id,
      'delivery',
      'Nouvelle livraison locale assignée',
      'La commande ' || NEW.order_ref || ' vous a été assignée pour livraison à ' || COALESCE(NEW.shipping_address, '') || ', ' || COALESCE(NEW.shipping_city, '') || '.',
      '/driver'
    );

    -- Notify the customer
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.user_id,
      'delivery',
      'Livreur assigné',
      'Un livreur (' || COALESCE(NEW.assigned_driver_name, 'N/A') || ') a été assigné pour votre commande ' || NEW.order_ref || '.',
      '/tracking'
    );

    -- Auto-create delivery record
    INSERT INTO public.deliveries (
      rider_id, order_id, order_ref, customer_name, customer_phone,
      address, items_count, amount, status, delivery_date
    )
    SELECT
      NEW.assigned_driver_id,
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

DROP TRIGGER IF EXISTS trg_auto_handle_local_driver ON public.orders;
CREATE TRIGGER trg_auto_handle_local_driver
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_handle_local_driver_assignment();

-- Add shop_type to vendor_applications for form storage
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS shop_type text DEFAULT 'international';
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'zandofy_warehouse';
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS fleet_management text DEFAULT 'platform';
