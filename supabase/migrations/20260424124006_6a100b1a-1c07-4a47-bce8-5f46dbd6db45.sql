-- Lot 4I — Forwarder Handoff system
-- Table: forwarder_handoffs
CREATE TABLE IF NOT EXISTS public.forwarder_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  forwarder_id uuid NOT NULL REFERENCES public.forwarders(id) ON DELETE RESTRICT,
  freight_quote_id uuid REFERENCES public.freight_quotes(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.forwarder_pricing_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','notified','acknowledged','in_transit','delivered','cancelled')),
  notification_payload jsonb DEFAULT '{}'::jsonb,
  notified_at timestamptz,
  acknowledged_at timestamptz,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, forwarder_id)
);

CREATE INDEX IF NOT EXISTS idx_forwarder_handoffs_forwarder ON public.forwarder_handoffs(forwarder_id, status);
CREATE INDEX IF NOT EXISTS idx_forwarder_handoffs_order ON public.forwarder_handoffs(order_id);

ALTER TABLE public.forwarder_handoffs ENABLE ROW LEVEL SECURITY;

-- Admin / manager: full access
CREATE POLICY "Admins manage forwarder handoffs"
  ON public.forwarder_handoffs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Linked transporter user: see + update their own handoffs
CREATE POLICY "Forwarder user views own handoffs"
  ON public.forwarder_handoffs FOR SELECT
  USING (
    forwarder_id IN (SELECT id FROM public.forwarders WHERE linked_transporter_user_id = auth.uid())
  );

CREATE POLICY "Forwarder user updates own handoffs"
  ON public.forwarder_handoffs FOR UPDATE
  USING (
    forwarder_id IN (SELECT id FROM public.forwarders WHERE linked_transporter_user_id = auth.uid())
  )
  WITH CHECK (
    forwarder_id IN (SELECT id FROM public.forwarders WHERE linked_transporter_user_id = auth.uid())
  );

-- Order owner: read-only on their handoff
CREATE POLICY "Order owner views handoff"
  ON public.forwarder_handoffs FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

-- updated_at trigger
CREATE TRIGGER trg_forwarder_handoffs_updated_at
BEFORE UPDATE ON public.forwarder_handoffs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create handoff + notify forwarder user when a freight_quote is consumed
CREATE OR REPLACE FUNCTION public.create_forwarder_handoff_on_quote_consumed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_forwarder_id uuid;
  v_linked_user uuid;
  v_order_ref text;
BEGIN
  IF NEW.status = 'consumed' AND OLD.status IS DISTINCT FROM 'consumed' AND NEW.order_id IS NOT NULL THEN
    -- Find forwarder via profile
    SELECT fpp.forwarder_id INTO v_forwarder_id
    FROM public.forwarder_pricing_profiles fpp
    WHERE fpp.id = NEW.profile_id;

    IF v_forwarder_id IS NULL THEN RETURN NEW; END IF;

    SELECT linked_transporter_user_id INTO v_linked_user
    FROM public.forwarders WHERE id = v_forwarder_id;

    SELECT order_ref INTO v_order_ref FROM public.orders WHERE id = NEW.order_id;

    -- Create handoff (idempotent via UNIQUE)
    INSERT INTO public.forwarder_handoffs (
      order_id, forwarder_id, freight_quote_id, profile_id, status,
      notification_payload, notified_at
    ) VALUES (
      NEW.order_id, v_forwarder_id, NEW.id, NEW.profile_id, 'notified',
      jsonb_build_object(
        'order_ref', v_order_ref,
        'cbm', NEW.cbm,
        'weight_kg', NEW.weight_kg,
        'pieces_count', NEW.pieces_count,
        'quoted_price', NEW.quoted_price,
        'currency', NEW.currency
      ),
      now()
    )
    ON CONFLICT (order_id, forwarder_id) DO NOTHING;

    -- In-app notification to linked transporter user
    IF v_linked_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_linked_user,
        'shipment',
        'Nouvelle commande à traiter',
        'Commande ' || COALESCE(v_order_ref, NEW.order_id::text)
          || ' — ' || NEW.pieces_count || ' colis, ' || NEW.weight_kg || ' kg',
        '/forwarder'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_forwarder_handoff ON public.freight_quotes;
CREATE TRIGGER trg_create_forwarder_handoff
AFTER UPDATE ON public.freight_quotes
FOR EACH ROW
EXECUTE FUNCTION public.create_forwarder_handoff_on_quote_consumed();