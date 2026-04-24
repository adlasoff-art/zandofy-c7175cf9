-- Lot 4N: Pont fret international → livraison locale
-- Quand un handoff transitaire passe en "delivered" (= colis arrivé au hub local),
-- on bascule automatiquement la commande sur le statut "shipped" qui démarre
-- le workflow last-mile (assignation livreur, livraison ou retrait au hub).

CREATE OR REPLACE FUNCTION public.bridge_handoff_to_last_mile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
  v_order_user_id uuid;
BEGIN
  -- Only act on transition to 'delivered'
  IF NEW.status <> 'delivered' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'delivered' THEN
    -- Already delivered, no transition
    RETURN NEW;
  END IF;

  -- Fetch current order state
  SELECT status, user_id
    INTO v_order_status, v_order_user_id
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_order_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only advance if order is still upstream (not already at hub or beyond)
  IF v_order_status IN ('pending', 'confirmed', 'preparing', 'in_shipping') THEN
    UPDATE public.orders
       SET status = 'shipped',
           updated_at = now()
     WHERE id = NEW.order_id;

    -- Drop in-app notification for the customer
    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    VALUES (
      v_order_user_id,
      'order_at_hub',
      'Votre colis est arrivé au hub local',
      'Votre commande vient d''arriver au hub. Vous pouvez maintenant choisir la livraison à domicile ou le retrait sur place.',
      jsonb_build_object(
        'order_id', NEW.order_id,
        'handoff_id', NEW.id,
        'tracking_number', NEW.tracking_number,
        'tracking_carrier', NEW.tracking_carrier
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_handoff_to_last_mile ON public.forwarder_handoffs;
CREATE TRIGGER trg_bridge_handoff_to_last_mile
AFTER INSERT OR UPDATE OF status ON public.forwarder_handoffs
FOR EACH ROW
EXECUTE FUNCTION public.bridge_handoff_to_last_mile();