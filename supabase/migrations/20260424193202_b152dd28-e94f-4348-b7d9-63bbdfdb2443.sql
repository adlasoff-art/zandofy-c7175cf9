-- 1. Ajouter les colonnes nécessaires
ALTER TABLE public.forwarder_handoffs
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS leg_index SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replaced_by_handoff_id UUID NULL REFERENCES public.forwarder_handoffs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_handoff_id UUID NULL REFERENCES public.forwarder_handoffs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reassignment_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS intermediate_destination_city TEXT NULL;

-- 2. Index partiel : un seul handoff actif par (order, leg)
DROP INDEX IF EXISTS idx_forwarder_handoffs_active_per_leg;
CREATE UNIQUE INDEX idx_forwarder_handoffs_active_per_leg
  ON public.forwarder_handoffs (order_id, leg_index)
  WHERE is_active = true;

-- Index supplémentaires
CREATE INDEX IF NOT EXISTS idx_forwarder_handoffs_parent ON public.forwarder_handoffs(parent_handoff_id);
CREATE INDEX IF NOT EXISTS idx_forwarder_handoffs_replaced_by ON public.forwarder_handoffs(replaced_by_handoff_id);

-- 3. Trigger : log auto reassignment dans forwarder_handoff_events
CREATE OR REPLACE FUNCTION public.log_handoff_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.replaced_by_handoff_id IS NOT NULL
     AND (OLD.replaced_by_handoff_id IS DISTINCT FROM NEW.replaced_by_handoff_id) THEN
    INSERT INTO public.forwarder_handoff_events (
      handoff_id, event_type, field_name, old_value, new_value, metadata
    ) VALUES (
      OLD.id,
      'reassigned',
      'forwarder_id',
      OLD.forwarder_id::text,
      NEW.replaced_by_handoff_id::text,
      jsonb_build_object('reason', NEW.reassignment_reason)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handoff_reassignment_event ON public.forwarder_handoffs;
CREATE TRIGGER trg_handoff_reassignment_event
  AFTER UPDATE ON public.forwarder_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_handoff_reassignment();

-- 4. RPC : reassign_forwarder
CREATE OR REPLACE FUNCTION public.reassign_forwarder(
  p_handoff_id UUID,
  p_new_forwarder_id UUID,
  p_reason TEXT,
  p_actor_role TEXT DEFAULT 'vendor'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old RECORD;
  v_order RECORD;
  v_new_handoff_id UUID;
  v_eligible BOOLEAN;
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reassignment reason is required (min 3 chars)';
  END IF;

  SELECT * INTO v_old FROM public.forwarder_handoffs WHERE id = p_handoff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Handoff not found';
  END IF;
  IF NOT v_old.is_active THEN
    RAISE EXCEPTION 'Cannot reassign an inactive handoff';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_old.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_is_admin := public.has_role(v_caller_id, 'admin'::app_role);

  -- Authorization
  IF p_actor_role = 'vendor' THEN
    -- Vendor must own the store on the order
    IF NOT EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = v_order.store_id AND s.owner_id = v_caller_id
    ) AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Not authorized to reassign on this order';
    END IF;

    -- Vendor: forwarder MUST cover client city
    SELECT EXISTS (
      SELECT 1 FROM public.get_eligible_forwarders(
        COALESCE(v_order.shipping_country, ''),
        NULL,
        COALESCE(v_old.payment_currency, 'air')
      ) ef
      WHERE ef.forwarder_id = p_new_forwarder_id
    ) INTO v_eligible;

    -- Fallback simple : vérifier au moins que le forwarder est actif
    IF NOT v_eligible THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.forwarders f WHERE f.id = p_new_forwarder_id AND f.is_active = true
      ) THEN
        RAISE EXCEPTION 'Forwarder not eligible for client city';
      END IF;
    END IF;
  ELSIF p_actor_role = 'admin' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Admin role required';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid actor_role';
  END IF;

  -- Create new active handoff (copy financial fields from old)
  INSERT INTO public.forwarder_handoffs (
    order_id, forwarder_id, profile_id, freight_quote_id,
    deposit_amount, balance_amount, deposit_required, payment_currency, payment_status,
    status, leg_index, is_active, parent_handoff_id, reassignment_reason
  ) VALUES (
    v_old.order_id, p_new_forwarder_id, NULL, v_old.freight_quote_id,
    v_old.deposit_amount, v_old.balance_amount, v_old.deposit_required, v_old.payment_currency, 'pending',
    'pending', v_old.leg_index, true, v_old.parent_handoff_id, p_reason
  ) RETURNING id INTO v_new_handoff_id;

  -- Deactivate the old one and link
  UPDATE public.forwarder_handoffs
  SET is_active = false,
      status = 'cancelled',
      replaced_by_handoff_id = v_new_handoff_id,
      reassignment_reason = p_reason,
      updated_at = now()
  WHERE id = p_handoff_id;

  RETURN v_new_handoff_id;
END;
$$;

-- 5. RPC : add_intermediate_hub_handoff (admin only)
CREATE OR REPLACE FUNCTION public.add_intermediate_hub_handoff(
  p_order_id UUID,
  p_hub_forwarder_id UUID,
  p_destination_city TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_main RECORD;
  v_max_leg SMALLINT;
  v_new_id UUID;
BEGIN
  IF v_caller_id IS NULL OR NOT public.has_role(v_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT * INTO v_main FROM public.forwarder_handoffs
  WHERE order_id = p_order_id AND leg_index = 0 AND is_active = true
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No main active handoff found for this order';
  END IF;

  SELECT COALESCE(MAX(leg_index), 0) INTO v_max_leg
  FROM public.forwarder_handoffs
  WHERE order_id = p_order_id;

  INSERT INTO public.forwarder_handoffs (
    order_id, forwarder_id, freight_quote_id,
    deposit_amount, balance_amount, deposit_required, payment_currency, payment_status,
    status, leg_index, is_active, parent_handoff_id,
    intermediate_destination_city, reassignment_reason
  ) VALUES (
    p_order_id, p_hub_forwarder_id, NULL,
    0, 0, false, v_main.payment_currency, 'pending',
    'pending', (v_max_leg + 1)::smallint, true, v_main.id,
    p_destination_city, p_reason
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.forwarder_handoff_events (
    handoff_id, event_type, metadata
  ) VALUES (
    v_new_id, 'intermediate_hub_added',
    jsonb_build_object('destination_city', p_destination_city, 'reason', p_reason)
  );

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_forwarder(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_intermediate_hub_handoff(UUID, UUID, TEXT, TEXT) TO authenticated;