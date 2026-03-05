
-- Trigger: notify when a delivery status changes
CREATE OR REPLACE FUNCTION public.notify_delivery_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_order_user_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get the customer who placed the order
    IF NEW.order_id IS NOT NULL THEN
      SELECT user_id INTO v_order_user_id
      FROM public.orders
      WHERE id = NEW.order_id;
    END IF;

    -- Notify the rider
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.rider_id,
      'delivery',
      'Livraison mise à jour',
      'La livraison pour ' || NEW.customer_name || ' est maintenant : ' || NEW.status,
      '/rider'
    );

    -- Notify the customer if we have their user_id
    IF v_order_user_id IS NOT NULL AND v_order_user_id != NEW.rider_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_order_user_id,
        'delivery',
        'Mise à jour livraison',
        'Votre livraison est maintenant : ' || NEW.status,
        '/tracking'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_delivery_status_change
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_delivery_status();

-- Trigger: notify when a shipment status changes
CREATE OR REPLACE FUNCTION public.notify_shipment_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify the shipper
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.shipper_id,
      'shipment',
      'Expédition mise à jour',
      'Expédition ' || NEW.awb_bl || ' (' || NEW.origin || ' → ' || NEW.destination || ') : ' || NEW.status,
      '/shipper'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_shipment_status_change
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shipment_status();
