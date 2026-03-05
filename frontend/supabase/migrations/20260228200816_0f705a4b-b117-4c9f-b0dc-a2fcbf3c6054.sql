
-- Add tracking number for shipment tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number text;

-- Add delivery choice: 'home_delivery' or 'hub_pickup' (null = not yet chosen)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_choice text;

-- Add last-mile delivery fee set by vendor (for self-delivery)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_mile_fee numeric DEFAULT 0;

-- Add last-mile payment method ('cash' or 'mobile_money')
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_mile_payment_method text;

-- Add pickup/delivery confirmation code (6 alphanumeric chars)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmation_code text;

-- Add assigned rider reference
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_rider_id uuid;

-- Add rider name cache for display
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_rider_name text;

-- Update RLS: allow customer to update delivery_choice on their own orders
CREATE POLICY "Users can update delivery choice on own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Notification trigger: notify client when order arrives at hub (status = shipped)
-- to choose delivery or pickup
CREATE OR REPLACE FUNCTION public.notify_hub_arrival_choice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_has_self_delivery boolean;
  v_last_mile numeric;
  v_msg text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only fire when transitioning to 'shipped' (arrived at hub)
  IF NEW.status != 'shipped' THEN
    RETURN NEW;
  END IF;

  -- Check if vendor store has self-delivery
  IF NEW.store_id IS NOT NULL THEN
    SELECT COALESCE(s.flash_timer_enabled, false) INTO v_store_has_self_delivery
    FROM public.stores s WHERE s.id = NEW.store_id;
  END IF;

  v_last_mile := COALESCE(NEW.last_mile_fee, 0);

  IF v_last_mile > 0 THEN
    v_msg := 'Votre commande ' || NEW.order_ref || ' est arrivée au Hub ! Livraison à domicile : $' || v_last_mile::text || '. Choisissez votre option de réception.';
  ELSE
    v_msg := 'Votre commande ' || NEW.order_ref || ' est arrivée au Hub ! Voulez-vous être livré à domicile ou passer récupérer votre colis ?';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    NEW.user_id,
    'order',
    'Commande arrivée au Hub',
    v_msg,
    '/dashboard'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_hub_arrival ON public.orders;
CREATE TRIGGER trg_notify_hub_arrival
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_hub_arrival_choice();

-- Notification: notify rider when client chooses home delivery
CREATE OR REPLACE FUNCTION public.notify_rider_assignment()
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
    -- Notify the rider
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assigned_rider_id,
      'delivery',
      'Nouvelle livraison assignée',
      'La commande ' || NEW.order_ref || ' vous a été assignée pour livraison à ' || COALESCE(NEW.shipping_address, '') || ', ' || COALESCE(NEW.shipping_city, '') || '.',
      '/driver'
    );

    -- Notify the customer
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.user_id,
      'delivery',
      'Livreur assigné',
      'Un livreur (' || COALESCE(NEW.assigned_rider_name, 'N/A') || ') a été assigné pour votre commande ' || NEW.order_ref || '.',
      '/tracking'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_rider_assignment ON public.orders;
CREATE TRIGGER trg_notify_rider_assignment
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_rider_assignment();
