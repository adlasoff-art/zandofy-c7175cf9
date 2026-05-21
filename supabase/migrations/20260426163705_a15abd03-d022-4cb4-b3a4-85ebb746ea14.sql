-- Phase B7 : Workflow d'acceptation/refus opérateur

-- 1. Ajout colonnes sur orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS operator_acceptance_status TEXT NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS operator_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_response_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS operator_reassignment_count INT NOT NULL DEFAULT 0;

-- Validation par trigger (pas de CHECK pour rester flexible)
CREATE OR REPLACE FUNCTION public.validate_operator_acceptance_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.operator_acceptance_status NOT IN
    ('pending','accepted','declined','expired','not_applicable')
  THEN
    RAISE EXCEPTION 'Invalid operator_acceptance_status: %', NEW.operator_acceptance_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_operator_acceptance_status ON public.orders;
CREATE TRIGGER trg_validate_operator_acceptance_status
  BEFORE INSERT OR UPDATE OF operator_acceptance_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_operator_acceptance_status();

CREATE INDEX IF NOT EXISTS idx_orders_operator_acceptance
  ON public.orders (delivery_operator_id, operator_acceptance_status)
  WHERE delivery_operator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_operator_response_deadline
  ON public.orders (operator_response_deadline)
  WHERE operator_acceptance_status = 'pending';

-- 2. Historique des réassignations
CREATE TABLE IF NOT EXISTS public.operator_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_operator_id UUID REFERENCES public.delivery_operators(id) ON DELETE SET NULL,
  new_operator_id UUID REFERENCES public.delivery_operators(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT 'manual',
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_assign_hist_order
  ON public.operator_assignment_history (order_id);

ALTER TABLE public.operator_assignment_history ENABLE ROW LEVEL SECURITY;

-- RLS : admin/manager
DROP POLICY IF EXISTS "Admins manage operator history" ON public.operator_assignment_history;
CREATE POLICY "Admins manage operator history"
  ON public.operator_assignment_history
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- RLS : opérateur peut voir son propre historique
DROP POLICY IF EXISTS "Operator reads own history" ON public.operator_assignment_history;
CREATE POLICY "Operator reads own history"
  ON public.operator_assignment_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_operators op
      WHERE (op.id = previous_operator_id OR op.id = new_operator_id)
        AND op.owner_user_id = auth.uid()
    )
  );

-- 3. RLS orders : permettre à l'opérateur (owner) de mettre à jour
-- son acceptance_status sur ses commandes assignées.
DROP POLICY IF EXISTS "Operator updates own assignment" ON public.orders;
CREATE POLICY "Operator updates own assignment"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    delivery_operator_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.delivery_operators op
      WHERE op.id = orders.delivery_operator_id
        AND op.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    delivery_operator_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.delivery_operators op
      WHERE op.id = orders.delivery_operator_id
        AND op.owner_user_id = auth.uid()
    )
  );

-- 4. Helper RPC : décision opérateur (accept / decline)
CREATE OR REPLACE FUNCTION public.operator_decide_order(
  p_order_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order RECORD;
  v_operator RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_decision NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.delivery_operator_id IS NULL THEN
    RAISE EXCEPTION 'Order has no operator assigned';
  END IF;

  SELECT * INTO v_operator FROM public.delivery_operators
    WHERE id = v_order.delivery_operator_id;
  IF v_operator.owner_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Forbidden: not the operator owner';
  END IF;

  IF v_order.operator_acceptance_status <> 'pending' THEN
    RAISE EXCEPTION 'Order is not awaiting decision (status=%)',
      v_order.operator_acceptance_status;
  END IF;

  UPDATE public.orders
     SET operator_acceptance_status = p_decision,
         operator_responded_at      = now(),
         operator_decline_reason    = CASE WHEN p_decision = 'declined' THEN p_reason ELSE NULL END
   WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'status', p_decision);
END;
$$;

GRANT EXECUTE ON FUNCTION public.operator_decide_order(UUID, TEXT, TEXT) TO authenticated;
