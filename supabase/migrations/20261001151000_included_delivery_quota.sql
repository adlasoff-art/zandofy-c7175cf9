-- Purpose: Phase C2 — Enterprise included last-mile quota (4/month, ≤10 kg).
-- Tables: store_included_delivery_usage; orders.included_delivery_credit;
--         RPCs try_consume_included_delivery, get_included_delivery_quota
-- Risk: medium (money). Only consumes when plan/entitlement allows; idempotent per order.
-- Staging → production: after 20261001150000; smoke Enterprise 5th order + overweight.
-- Rollback: DROP TRIGGER/FUNCTIONS; DROP TABLE store_included_delivery_usage;
--           ALTER TABLE orders DROP COLUMN included_delivery_credit (explicit human only).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS included_delivery_credit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.included_delivery_credit IS
  'True when Enterprise included last-mile credit was consumed for this order.';

CREATE TABLE IF NOT EXISTS public.store_included_delivery_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  weight_kg numeric NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_included_delivery_usage_store_month
  ON public.store_included_delivery_usage (store_id, year_month);

ALTER TABLE public.store_included_delivery_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store team read included delivery usage" ON public.store_included_delivery_usage;
CREATE POLICY "Store team read included delivery usage"
  ON public.store_included_delivery_usage FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = store_included_delivery_usage.store_id
        AND sc.user_id = auth.uid() AND sc.status = 'active'
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS "Admins manage included delivery usage" ON public.store_included_delivery_usage;
CREATE POLICY "Admins manage included delivery usage"
  ON public.store_included_delivery_usage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_included_delivery_quota(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent jsonb;
  v_limit int := 0;
  v_max_kg numeric := 10;
  v_month text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_used int := 0;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store');
  END IF;

  -- Allow store team / admin / service (auth.uid null for service role inserts via try_consume)
  IF auth.uid() IS NOT NULL AND NOT (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p_store_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = p_store_id AND sc.user_id = auth.uid() AND sc.status = 'active'
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Resolve plan quotas without depending on buyer JWT for checkout path:
  -- try_consume uses same internals.
  SELECT COALESCE(p.included_deliveries_per_month, 0), COALESCE(p.max_kg_per_included_delivery, 10)
  INTO v_limit, v_max_kg
  FROM public.vendor_subscriptions vs
  JOIN public.vendor_plan_definitions p ON p.slug = CASE
    WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
    ELSE vs.tier::text
  END AND p.is_active
  WHERE vs.store_id = p_store_id;

  IF v_limit IS NULL THEN
    v_limit := 0;
    v_max_kg := 10;
  END IF;

  SELECT COUNT(*)::int INTO v_used
  FROM public.store_included_delivery_usage u
  WHERE u.store_id = p_store_id AND u.year_month = v_month;

  RETURN jsonb_build_object(
    'ok', true,
    'year_month', v_month,
    'used', v_used,
    'limit', v_limit,
    'remaining', GREATEST(v_limit - v_used, 0),
    'max_kg_per_included_delivery', v_max_kg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_included_delivery_quota(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.try_consume_included_delivery(
  p_store_id uuid,
  p_order_id uuid,
  p_weight_kg numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota jsonb;
  v_limit int;
  v_used int;
  v_max_kg numeric;
  v_month text;
  v_weight numeric := COALESCE(p_weight_kg, 0);
BEGIN
  IF p_store_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'missing_args');
  END IF;

  -- Idempotent: already consumed for this order
  IF EXISTS (SELECT 1 FROM public.store_included_delivery_usage WHERE order_id = p_order_id) THEN
    UPDATE public.orders SET included_delivery_credit = true WHERE id = p_order_id;
    RETURN jsonb_build_object('consumed', true, 'reason', 'already_consumed');
  END IF;

  v_quota := public.get_included_delivery_quota(p_store_id);
  IF COALESCE((v_quota->>'ok')::boolean, false) IS NOT TRUE AND (v_quota->>'error') = 'forbidden' THEN
    -- Checkout buyers cannot call get_included_delivery_quota access check —
    -- recompute inline for SECURITY DEFINER consume path
    v_month := to_char(timezone('utc', now()), 'YYYY-MM');
    SELECT COALESCE(p.included_deliveries_per_month, 0), COALESCE(p.max_kg_per_included_delivery, 10)
    INTO v_limit, v_max_kg
    FROM public.vendor_subscriptions vs
    JOIN public.vendor_plan_definitions p ON p.slug = CASE
      WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
      ELSE vs.tier::text
    END AND p.is_active
    WHERE vs.store_id = p_store_id;
    IF v_limit IS NULL THEN v_limit := 0; v_max_kg := 10; END IF;
    SELECT COUNT(*)::int INTO v_used
    FROM public.store_included_delivery_usage u
    WHERE u.store_id = p_store_id AND u.year_month = v_month;
  ELSE
    v_limit := COALESCE((v_quota->>'limit')::int, 0);
    v_used := COALESCE((v_quota->>'used')::int, 0);
    v_max_kg := COALESCE((v_quota->>'max_kg_per_included_delivery')::numeric, 10);
    v_month := COALESCE(v_quota->>'year_month', to_char(timezone('utc', now()), 'YYYY-MM'));
  END IF;

  IF COALESCE(v_limit, 0) <= 0 THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'no_quota');
  END IF;

  IF v_weight > v_max_kg THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'over_weight', 'max_kg', v_max_kg);
  END IF;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'quota_exhausted', 'used', v_used, 'limit', v_limit);
  END IF;

  INSERT INTO public.store_included_delivery_usage (store_id, order_id, year_month, weight_kg)
  VALUES (p_store_id, p_order_id, v_month, v_weight);

  UPDATE public.orders
  SET included_delivery_credit = true,
      last_mile_fee = 0
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'consumed', true,
    'remaining', GREATEST(v_limit - v_used - 1, 0),
    'year_month', v_month
  );
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.orders SET included_delivery_credit = true, last_mile_fee = 0 WHERE id = p_order_id;
    RETURN jsonb_build_object('consumed', true, 'reason', 'race_already_consumed');
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_included_delivery(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_consume_included_delivery(uuid, uuid, numeric) TO authenticated;

COMMENT ON FUNCTION public.try_consume_included_delivery(uuid, uuid, numeric) IS
  'Atomically consume one included last-mile credit for the store calendar month if weight ≤ max_kg.';

GRANT EXECUTE ON FUNCTION public.get_included_delivery_quota(uuid) TO authenticated;
