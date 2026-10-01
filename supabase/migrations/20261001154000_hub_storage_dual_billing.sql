-- Purpose: Phase C5 — hub dual billing (vendor 14d / buyer 21d) + charges ledger.
-- Tables: hub_storage_tracking columns; hub_storage_charges;
--         RPCs register_hub_storage_arrival, accrue helpers for Edge cron.
-- Risk: medium. Additive; existing rows default vendor_inventory + 14d.
-- Staging → production: after C1 hub_storage entitlement; deploy Edge accrue-hub-storage.
-- Rollback: stop cron; DROP hub_storage_charges (explicit human for DROP COLUMN).

ALTER TABLE public.hub_storage_tracking
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'vendor_inventory'
  CHECK (actor_type IN ('vendor_inventory', 'buyer_order'));

ALTER TABLE public.hub_storage_tracking
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.hub_storage_tracking
  ADD COLUMN IF NOT EXISTS is_restock boolean NOT NULL DEFAULT false;

ALTER TABLE public.hub_storage_tracking
  ADD COLUMN IF NOT EXISTS restock_within_free_window boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hub_storage_tracking.actor_type IS
  'vendor_inventory: 14 free days (new product); buyer_order: 21 free days then $1/day.';
COMMENT ON COLUMN public.hub_storage_tracking.is_restock IS
  'Vendor restocking; if within 14d of prior exit, no storage fee (movement only).';

CREATE TABLE IF NOT EXISTS public.hub_storage_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES public.hub_storage_tracking(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid,
  charge_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  weight_kg numeric NOT NULL DEFAULT 0,
  daily_rate numeric NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracking_id, charge_date)
);

CREATE INDEX IF NOT EXISTS idx_hub_storage_charges_store ON public.hub_storage_charges (store_id);
CREATE INDEX IF NOT EXISTS idx_hub_storage_charges_order ON public.hub_storage_charges (order_id);

ALTER TABLE public.hub_storage_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage hub storage charges" ON public.hub_storage_charges;
CREATE POLICY "Admins manage hub storage charges"
  ON public.hub_storage_charges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Store owners read hub charges" ON public.hub_storage_charges;
CREATE POLICY "Store owners read hub charges"
  ON public.hub_storage_charges FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.register_hub_storage_arrival(
  p_store_id uuid,
  p_actor_type text,
  p_weight_kg numeric,
  p_product_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_is_restock boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_free_days int;
  v_rate numeric;
  v_free_until timestamptz;
  v_buyer uuid;
BEGIN
  IF p_actor_type = 'buyer_order' THEN
    v_free_days := 21;
    v_rate := 1.00;
  ELSE
    v_free_days := 14;
    v_rate := 0.59;
  END IF;

  -- Restock within free window: no storage fee accrual
  IF COALESCE(p_is_restock, false) AND p_actor_type = 'vendor_inventory' THEN
    v_free_until := now() + interval '100 years'; -- effectively never charge storage
    v_rate := 0;
  ELSE
    v_free_until := now() + make_interval(days => v_free_days);
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT o.user_id INTO v_buyer FROM public.orders o WHERE o.id = p_order_id;
  END IF;

  INSERT INTO public.hub_storage_tracking (
    store_id, product_id, order_id, actor_type, weight_kg,
    arrived_at, free_until, daily_rate, is_restock, restock_within_free_window
  ) VALUES (
    p_store_id, p_product_id, p_order_id, p_actor_type, COALESCE(p_weight_kg, 0),
    now(), v_free_until, v_rate, COALESCE(p_is_restock, false),
    COALESCE(p_is_restock, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_hub_storage_arrival(uuid, text, numeric, uuid, uuid, boolean)
  TO authenticated;

-- Accrue one day of charges for rows past free_until (called by Edge cron with service role)
CREATE OR REPLACE FUNCTION public.accrue_hub_storage_charges(p_as_of date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_amount numeric;
  v_inserted int := 0;
  v_buyer uuid;
  v_rows int;
BEGIN
  FOR r IN
    SELECT t.*
    FROM public.hub_storage_tracking t
    WHERE t.free_until::date < p_as_of
      AND COALESCE(t.daily_rate, 0) > 0
      AND COALESCE(t.restock_within_free_window, false) = false
  LOOP
    IF r.actor_type = 'buyer_order' THEN
      v_amount := COALESCE(r.daily_rate, 1.00);
    ELSE
      v_amount := ROUND(COALESCE(r.daily_rate, 0) * GREATEST(COALESCE(r.weight_kg, 1), 0.001), 2);
    END IF;

    SELECT o.user_id INTO v_buyer FROM public.orders o WHERE o.id = r.order_id;

    INSERT INTO public.hub_storage_charges (
      tracking_id, store_id, order_id, user_id, charge_date, amount, weight_kg, daily_rate
    ) VALUES (
      r.id, r.store_id, r.order_id, v_buyer, p_as_of, v_amount, r.weight_kg, r.daily_rate
    )
    ON CONFLICT (tracking_id, charge_date) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_inserted := v_inserted + 1;
      UPDATE public.hub_storage_tracking
      SET is_penalty_active = true,
          total_penalty = COALESCE(total_penalty, 0) + v_amount,
          last_penalty_at = now(),
          updated_at = now()
      WHERE id = r.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'charges_inserted', v_inserted, 'as_of', p_as_of);
END;
$$;

REVOKE ALL ON FUNCTION public.accrue_hub_storage_charges(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accrue_hub_storage_charges(date) TO service_role;
