
-- 1. Update log_handoff_event to log notes_updated
CREATE OR REPLACE FUNCTION public.log_handoff_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NOT NULL THEN
    SELECT role::text INTO v_actor_role
    FROM public.user_roles
    WHERE user_id = v_actor_id
    ORDER BY CASE role::text
      WHEN 'admin' THEN 1
      WHEN 'transporter' THEN 2
      ELSE 3
    END
    LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.forwarder_handoff_events (handoff_id, event_type, field_name, old_value, new_value, actor_id, actor_role)
    VALUES (NEW.id, 'created', 'status', NULL, NEW.status, v_actor_id, v_actor_role);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.forwarder_handoff_events (handoff_id, event_type, field_name, old_value, new_value, actor_id, actor_role)
    VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, v_actor_id, v_actor_role);
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.forwarder_handoff_events (handoff_id, event_type, field_name, old_value, new_value, actor_id, actor_role)
    VALUES (NEW.id, 'payment_status_changed', 'payment_status', OLD.payment_status, NEW.payment_status, v_actor_id, v_actor_role);
  END IF;

  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number THEN
    INSERT INTO public.forwarder_handoff_events (handoff_id, event_type, field_name, old_value, new_value, actor_id, actor_role)
    VALUES (NEW.id, 'tracking_updated', 'tracking_number', OLD.tracking_number, NEW.tracking_number, v_actor_id, v_actor_role);
  END IF;

  IF NEW.tracking_carrier IS DISTINCT FROM OLD.tracking_carrier THEN
    INSERT INTO public.forwarder_handoff_events (handoff_id, event_type, field_name, old_value, new_value, actor_id, actor_role)
    VALUES (NEW.id, 'carrier_updated', 'tracking_carrier', OLD.tracking_carrier, NEW.tracking_carrier, v_actor_id, v_actor_role);
  END IF;

  IF COALESCE(NEW.deposit_paid_amount, 0) IS DISTINCT FROM COALESCE(OLD.deposit_paid_amount, 0) THEN
    INSERT INTO public.forwarder_handoff_events (handoff_id, event_type, field_name, old_value, new_value, actor_id, actor_role)
    VALUES (NEW.id, 'deposit_payment', 'deposit_paid_amount', OLD.deposit_paid_amount::text, NEW.deposit_paid_amount::text, v_actor_id, v_actor_role);
  END IF;

  IF COALESCE(NEW.balance_paid_amount, 0) IS DISTINCT FROM COALESCE(OLD.balance_paid_amount, 0) THEN
    INSERT INTO public.forwarder_handoff_events (handoff_id, event_type, field_name, old_value, new_value, actor_id, actor_role)
    VALUES (NEW.id, 'balance_payment', 'balance_paid_amount', OLD.balance_paid_amount::text, NEW.balance_paid_amount::text, v_actor_id, v_actor_role);
  END IF;

  -- H2: log note updates so the timeline shows "Message au client"
  IF COALESCE(NEW.internal_notes, '') IS DISTINCT FROM COALESCE(OLD.internal_notes, '') THEN
    INSERT INTO public.forwarder_handoff_events (handoff_id, event_type, field_name, old_value, new_value, actor_id, actor_role)
    VALUES (NEW.id, 'notes_updated', 'internal_notes', OLD.internal_notes, NEW.internal_notes, v_actor_id, v_actor_role);
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Trigger to notify customer when transporter posts/updates a note
CREATE OR REPLACE FUNCTION public.notify_customer_handoff_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_order_ref text;
  v_order_id uuid;
  v_recent_count int;
  v_title text;
  v_message text;
  v_supabase_url text;
  v_service_key text;
  v_function_url text;
BEGIN
  -- Only when note text actually changes and is non-empty (skip clears)
  IF COALESCE(NEW.internal_notes, '') IS NOT DISTINCT FROM COALESCE(OLD.internal_notes, '') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(TRIM(NEW.internal_notes), '') = '' THEN
    RETURN NEW;
  END IF;

  -- Throttle: max 1 note notification per handoff per 30 min
  SELECT COUNT(*) INTO v_recent_count
  FROM public.forwarder_handoff_events
  WHERE handoff_id = NEW.id
    AND event_type = 'notes_updated'
    AND created_at > now() - interval '30 minutes';

  IF v_recent_count > 1 THEN
    -- (>1 because the current update has just been logged by log_handoff_event)
    RETURN NEW;
  END IF;

  -- Resolve order owner
  SELECT user_id, order_ref, id INTO v_user_id, v_order_ref, v_order_id
  FROM public.orders WHERE id = NEW.order_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := 'Message de votre transitaire';
  v_message := 'Commande ' || COALESCE(v_order_ref, v_order_id::text) || ' — '
    || left(NEW.internal_notes, 200);

  -- 1. In-app notification
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (v_user_id, 'shipment', v_title, v_message, '/dashboard');

  -- 2. Best-effort async email/push via pg_net
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
        body := jsonb_build_object(
          'handoffId', NEW.id,
          'type', 'note',
          'note', NEW.internal_notes
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-token', v_service_key,
          'Authorization', 'Bearer ' || v_service_key
        ),
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- best-effort
    END;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_customer_handoff_note ON public.forwarder_handoffs;
CREATE TRIGGER trg_notify_customer_handoff_note
AFTER UPDATE OF internal_notes ON public.forwarder_handoffs
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_handoff_note();
