-- Lot 4Q — Audit trail for forwarder handoffs
CREATE TABLE IF NOT EXISTS public.forwarder_handoff_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handoff_id UUID NOT NULL REFERENCES public.forwarder_handoffs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  actor_id UUID,
  actor_role TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_events_handoff_id ON public.forwarder_handoff_events(handoff_id);
CREATE INDEX IF NOT EXISTS idx_handoff_events_created_at ON public.forwarder_handoff_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_events_event_type ON public.forwarder_handoff_events(event_type);

ALTER TABLE public.forwarder_handoff_events ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins manage all handoff events"
ON public.forwarder_handoff_events
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Transporters: view events for handoffs linked to their forwarder profiles
CREATE POLICY "Transporters view their handoff events"
ON public.forwarder_handoff_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.forwarder_handoffs h
    LEFT JOIN public.forwarder_pricing_profiles p ON p.id = h.profile_id
    WHERE h.id = forwarder_handoff_events.handoff_id
      AND p.linked_transporter_user_id = auth.uid()
  )
);

-- Customers: view events for their own orders
CREATE POLICY "Customers view their handoff events"
ON public.forwarder_handoff_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.forwarder_handoffs h
    JOIN public.orders o ON o.id = h.order_id
    WHERE h.id = forwarder_handoff_events.handoff_id
      AND o.user_id = auth.uid()
  )
);

-- Trigger function: log handoff changes
CREATE OR REPLACE FUNCTION public.log_handoff_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Status change
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_handoff_event ON public.forwarder_handoffs;
CREATE TRIGGER trg_log_handoff_event
AFTER INSERT OR UPDATE ON public.forwarder_handoffs
FOR EACH ROW
EXECUTE FUNCTION public.log_handoff_event();