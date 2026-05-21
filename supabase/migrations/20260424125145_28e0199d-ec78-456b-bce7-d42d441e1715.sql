-- Lot 4L — Customer notifications on forwarder handoff status changes

-- Trigger function: in-app notification + async email via pg_net
CREATE OR REPLACE FUNCTION public.notify_customer_handoff_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_order_ref text;
  v_title text;
  v_message text;
  v_supabase_url text;
  v_service_key text;
  v_function_url text;
BEGIN
  -- Only react to actual status transitions on relevant statuses
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('acknowledged', 'in_transit', 'delivered', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Resolve order owner
  SELECT user_id, order_ref INTO v_user_id, v_order_ref
  FROM public.orders WHERE id = NEW.order_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build human-readable message
  CASE NEW.status
    WHEN 'acknowledged' THEN
      v_title := 'Commande prise en charge';
      v_message := 'Votre commande ' || COALESCE(v_order_ref, NEW.order_id::text)
        || ' a été réceptionnée par le transitaire et sera bientôt expédiée.';
    WHEN 'in_transit' THEN
      v_title := 'Expédition en transit';
      v_message := 'Votre commande ' || COALESCE(v_order_ref, NEW.order_id::text)
        || ' est désormais en route à l''international (transit + douane).';
    WHEN 'delivered' THEN
      v_title := 'Commande arrivée à destination';
      v_message := 'Votre commande ' || COALESCE(v_order_ref, NEW.order_id::text)
        || ' est arrivée au hub local. La livraison vers vous sera planifiée sous peu.';
    WHEN 'cancelled' THEN
      v_title := 'Expédition annulée';
      v_message := 'L''expédition internationale de votre commande '
        || COALESCE(v_order_ref, NEW.order_id::text)
        || ' a été annulée par le transitaire. Notre équipe vous recontactera.';
  END CASE;

  -- 1. In-app notification (always)
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (v_user_id, 'shipment', v_title, v_message, '/dashboard');

  -- 2. Best-effort async email via pg_net
  -- Vault keys: 'project_url' and 'service_role_key' (optional). Skip silently if missing.
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
    v_function_url := rtrim(v_supabase_url, '/') || '/functions/v1/notify-handoff-status-customer';
    BEGIN
      PERFORM extensions.http_post(
        url := v_function_url,
        body := jsonb_build_object('handoffId', NEW.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-token', v_service_key,
          'Authorization', 'Bearer ' || v_service_key
        ),
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      -- never block the status update on email failure
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_customer_handoff_status ON public.forwarder_handoffs;
CREATE TRIGGER trg_notify_customer_handoff_status
AFTER UPDATE OF status ON public.forwarder_handoffs
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_handoff_status_change();