
-- ============================================================
-- Workflow Transitaire → Hub → Opérateur : H1 + H3 + RPC H5
-- ============================================================

-- ---------- H1 : visibilité différée côté transitaire ----------

ALTER TABLE public.forwarder_handoffs
  ADD COLUMN IF NOT EXISTS visible_to_forwarder boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_forwarder_handoffs_visible
  ON public.forwarder_handoffs (forwarder_id, visible_to_forwarder, status)
  WHERE visible_to_forwarder = true;

-- À la création (depuis quote consumed) le handoff reste invisible et en 'pending'
CREATE OR REPLACE FUNCTION public.create_forwarder_handoff_on_quote_consumed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_forwarder_id uuid;
  v_order_ref text;
BEGIN
  IF NEW.status = 'consumed' AND OLD.status IS DISTINCT FROM 'consumed' AND NEW.order_id IS NOT NULL THEN
    SELECT fpp.forwarder_id INTO v_forwarder_id
    FROM public.forwarder_pricing_profiles fpp
    WHERE fpp.id = NEW.profile_id;

    IF v_forwarder_id IS NULL THEN RETURN NEW; END IF;

    SELECT order_ref INTO v_order_ref FROM public.orders WHERE id = NEW.order_id;

    INSERT INTO public.forwarder_handoffs (
      order_id, forwarder_id, freight_quote_id, profile_id, status,
      visible_to_forwarder,
      notification_payload
    ) VALUES (
      NEW.order_id, v_forwarder_id, NEW.id, NEW.profile_id, 'pending',
      false,
      jsonb_build_object(
        'order_ref', v_order_ref,
        'cbm', NEW.cbm,
        'weight_kg', NEW.weight_kg,
        'pieces_count', NEW.pieces_count,
        'quoted_price', NEW.quoted_price,
        'currency', NEW.currency
      )
    )
    ON CONFLICT (order_id, forwarder_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Mettre à jour la policy SELECT du transitaire pour ne montrer que les handoffs visibles
DROP POLICY IF EXISTS "Forwarder user views own handoffs" ON public.forwarder_handoffs;
CREATE POLICY "Forwarder user views own handoffs"
ON public.forwarder_handoffs
FOR SELECT
USING (
  visible_to_forwarder = true
  AND forwarder_id IN (
    SELECT id FROM public.forwarders WHERE linked_transporter_user_id = auth.uid()
  )
);

-- Trigger : quand orders.status passe à 'in_shipping' (vendeur a expédié)
-- → handoff actif devient visible + 'notified' + notif au transitaire
CREATE OR REPLACE FUNCTION public.reveal_handoff_on_shipping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked_user uuid;
  v_handoff RECORD;
BEGIN
  IF NEW.status = 'in_shipping' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR v_handoff IN
      SELECT h.id, h.forwarder_id, h.notification_payload
      FROM public.forwarder_handoffs h
      WHERE h.order_id = NEW.id
        AND h.is_active = true
        AND h.visible_to_forwarder = false
    LOOP
      UPDATE public.forwarder_handoffs
        SET visible_to_forwarder = true,
            status = CASE WHEN status = 'pending' THEN 'notified' ELSE status END,
            notified_at = COALESCE(notified_at, now()),
            updated_at = now()
      WHERE id = v_handoff.id;

      SELECT linked_transporter_user_id INTO v_linked_user
      FROM public.forwarders WHERE id = v_handoff.forwarder_id;

      IF v_linked_user IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          v_linked_user,
          'shipment',
          'Nouvelle commande à traiter',
          'Commande ' || NEW.order_ref || ' expédiée par le vendeur, à prendre en charge.',
          '/forwarder'
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reveal_handoff_on_shipping ON public.orders;
CREATE TRIGGER trg_reveal_handoff_on_shipping
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.reveal_handoff_on_shipping();

-- ---------- H3 : bascule auto handoff delivered → suite workflow ----------

CREATE OR REPLACE FUNCTION public.bridge_handoff_to_last_mile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_new_status text;
  v_code text;
  v_attempts int := 0;
BEGIN
  IF NEW.status <> 'delivered' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  SELECT id, status, user_id, delivery_choice, delivery_operator_id, pickup_code
    INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_order.user_id IS NULL THEN RETURN NEW; END IF;

  -- Ne pas écraser si la commande est déjà plus loin
  IF v_order.status NOT IN ('pending','confirmed','preparing','in_shipping') THEN
    RETURN NEW;
  END IF;

  -- Branche pickup hub : direct ready_for_pickup
  IF v_order.delivery_choice = 'hub_pickup' THEN
    v_new_status := 'ready_for_pickup';
  ELSE
    -- Domicile par défaut
    v_new_status := 'shipped';
  END IF;

  -- Génération du code de retrait (utilisé pour les deux branches)
  IF v_order.pickup_code IS NULL THEN
    LOOP
      v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.orders
        WHERE pickup_code = v_code AND pickup_code_verified_at IS NULL
      );
      v_attempts := v_attempts + 1;
      EXIT WHEN v_attempts > 20;
    END LOOP;
  ELSE
    v_code := v_order.pickup_code;
  END IF;

  UPDATE public.orders
     SET status = v_new_status,
         pickup_code = COALESCE(pickup_code, v_code),
         pickup_code_generated_at = COALESCE(pickup_code_generated_at, now()),
         operator_acceptance_status = CASE
           WHEN v_new_status = 'shipped' AND delivery_operator_id IS NOT NULL
             THEN 'pending'
           ELSE operator_acceptance_status
         END,
         operator_assigned_at = CASE
           WHEN v_new_status = 'shipped' AND delivery_operator_id IS NOT NULL
                AND operator_assigned_at IS NULL
             THEN now()
           ELSE operator_assigned_at
         END,
         operator_response_deadline = CASE
           WHEN v_new_status = 'shipped' AND delivery_operator_id IS NOT NULL
                AND operator_response_deadline IS NULL
             THEN now() + interval '30 minutes'
           ELSE operator_response_deadline
         END,
         updated_at = now()
   WHERE id = NEW.order_id;

  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  VALUES (
    v_order.user_id,
    'order_at_hub',
    CASE WHEN v_new_status = 'ready_for_pickup'
      THEN 'Votre colis est prêt au hub'
      ELSE 'Votre colis est arrivé au hub local'
    END,
    CASE WHEN v_new_status = 'ready_for_pickup'
      THEN 'Présentez-vous à l''agence avec votre code de retrait : ' || v_code
      ELSE 'Votre commande vient d''arriver au hub. La livraison va être organisée.'
    END,
    jsonb_build_object(
      'order_id', NEW.order_id,
      'handoff_id', NEW.id,
      'pickup_code', v_code,
      'new_status', v_new_status
    )
  );

  RETURN NEW;
END;
$$;

-- ---------- H5 : RPC verify_hub_pickup ----------

CREATE OR REPLACE FUNCTION public.verify_hub_pickup(
  p_order_id uuid,
  p_code text,
  p_proof_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, status, delivery_choice, pickup_code, pickup_code_verified_at, user_id, order_ref
    INTO v_order
  FROM public.orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.delivery_choice <> 'hub_pickup' THEN
    RAISE EXCEPTION 'not_a_pickup_order';
  END IF;

  IF v_order.pickup_code_verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_verified';
  END IF;

  IF v_order.pickup_code IS NULL OR v_order.pickup_code <> p_code THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  UPDATE public.orders
     SET pickup_code_verified_at = now(),
         pickup_verified_by = auth.uid(),
         hub_pickup_proof_url = COALESCE(p_proof_url, hub_pickup_proof_url),
         status = 'delivered',
         delivered_at = COALESCE(delivered_at, now()),
         updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_order.user_id,
    'order',
    'Colis remis',
    'Votre commande ' || v_order.order_ref || ' a bien été remise. Merci !',
    '/dashboard/orders'
  );

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_hub_pickup(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_hub_pickup(uuid, text, text) TO authenticated;
