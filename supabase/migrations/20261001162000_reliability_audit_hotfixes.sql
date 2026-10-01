-- Purpose: Reliability audit hotfixes (R0–R2).
-- - KYB: require auth on refresh RPC; block submit if score < 80 or docs incomplete
-- - try_consume_included_delivery: require buyer/staff JWT (no anonymous SECURITY DEFINER call)
-- Risk: low–medium. Additive; no DROP of columns. Existing drafts unchanged until submit.
-- Staging → production: after 160000/161000; smoke KYB submit gate + Enterprise credit consume.
-- Rollback: restore functions from 160000 / 155000; DROP trg_kyb_submit_gate.

-- ---------------------------------------------------------------------------
-- 1) refresh_kyb_completeness_score — require authenticated caller
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_kyb_completeness_score(p_submission_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_score int;
  v_uid uuid := auth.uid();
BEGIN
  IF p_submission_id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kyb_submissions ks
    JOIN public.stores s ON s.id = ks.store_id
    WHERE ks.id = p_submission_id
      AND (
        s.owner_id = v_uid
        OR ks.submitted_by = v_uid
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = v_uid AND sc.status = 'active'
        )
        OR public.has_role(v_uid, 'admin'::app_role)
        OR public.has_role(v_uid, 'manager'::app_role)
      )
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_score := public.compute_kyb_completeness(p_submission_id);

  UPDATE public.kyb_submissions
  SET completeness_score = v_score,
      updated_at = now()
  WHERE id = p_submission_id;

  RETURN v_score;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_kyb_completeness_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_kyb_completeness_score(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) KYB submit gate — score ≥ 80 + 5 required doc types (server-side)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_kyb_submit_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_score int;
  v_docs int;
BEGIN
  -- Only when transitioning into submitted (vendor submit path)
  IF NEW.status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  -- Staff may force-set submitted during review tooling
  IF auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  ) THEN
    RETURN NEW;
  END IF;

  v_score := public.compute_kyb_completeness(NEW.id);
  NEW.completeness_score := v_score;

  IF v_score < 80 THEN
    RAISE EXCEPTION 'kyb_incomplete_score:%', v_score
      USING ERRCODE = 'P0001',
            HINT = 'Completeness score must be >= 80 before submit';
  END IF;

  SELECT COUNT(DISTINCT doc_type) INTO v_docs
  FROM public.kyb_documents
  WHERE submission_id = NEW.id
    AND doc_type IN ('rccm', 'id_director', 'proof_address', 'tax_nif', 'bank_rib');

  IF COALESCE(v_docs, 0) < 5 THEN
    RAISE EXCEPTION 'kyb_incomplete_docs:%', v_docs
      USING ERRCODE = 'P0001',
            HINT = 'All 5 required KYB documents must be uploaded before submit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyb_submit_gate ON public.kyb_submissions;
CREATE TRIGGER trg_kyb_submit_gate
  BEFORE INSERT OR UPDATE OF status ON public.kyb_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_kyb_submit_readiness();

-- ---------------------------------------------------------------------------
-- 3) try_consume — require buyer/staff JWT (service_role still allowed via grant + null uid only when role is service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_consume_included_delivery(
  p_store_id uuid,
  p_order_id uuid,
  p_weight_kg numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
  v_limit int := 0;
  v_used int := 0;
  v_max_kg numeric := 10;
  v_month text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_weight numeric;
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_lane text;
  v_jwt_role text := nullif(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_store_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'missing_args');
  END IF;

  -- No JWT: only service_role (Edge). Block calls without a real user when not service_role.
  IF v_uid IS NULL AND v_jwt_role IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'forbidden');
  END IF;

  SELECT o.id, o.store_id, o.user_id, o.fulfillment_lane, o.geo_relation,
         o.delivery_choice, o.included_delivery_credit
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'order_not_found');
  END IF;

  IF v_order.store_id IS DISTINCT FROM p_store_id THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'store_mismatch');
  END IF;

  v_is_staff :=
    v_uid IS NOT NULL AND (
      public.has_role(v_uid, 'admin'::app_role)
      OR public.has_role(v_uid, 'manager'::app_role)
    );

  IF v_uid IS NOT NULL
     AND v_order.user_id IS DISTINCT FROM v_uid
     AND NOT v_is_staff
  THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'forbidden');
  END IF;

  v_lane := COALESCE(
    v_order.fulfillment_lane,
    CASE v_order.geo_relation
      WHEN 'same_city' THEN 'last_mile'
      WHEN 'same_country_other_city' THEN 'domestic'
      WHEN 'cross_border' THEN 'freight'
      ELSE NULL
    END
  );

  IF v_lane IS DISTINCT FROM 'last_mile' THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'not_last_mile');
  END IF;

  IF COALESCE(v_order.delivery_choice, 'home_delivery') <> 'home_delivery' THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'not_home_delivery');
  END IF;

  IF EXISTS (SELECT 1 FROM public.store_included_delivery_usage WHERE order_id = p_order_id)
     OR COALESCE(v_order.included_delivery_credit, false)
  THEN
    UPDATE public.orders
    SET included_delivery_credit = true,
        total = CASE
          WHEN COALESCE(last_mile_fee, 0) > 0
               AND last_mile_payment_status IN ('unpaid', 'paid')
          THEN GREATEST(0, total - last_mile_fee)
          ELSE total
        END,
        last_mile_fee = 0
    WHERE id = p_order_id;
    RETURN jsonb_build_object('consumed', true, 'reason', 'already_consumed');
  END IF;

  SELECT COALESCE(SUM(
    (COALESCE(NULLIF(p.weight_grams, 0), 500)::numeric * oi.quantity) / 1000.0
  ), COALESCE(p_weight_kg, 0))
  INTO v_weight
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;

  IF v_weight IS NULL OR v_weight <= 0 THEN
    v_weight := COALESCE(p_weight_kg, 0);
  END IF;

  SELECT COALESCE(pl.included_deliveries_per_month, 0),
         COALESCE(pl.max_kg_per_included_delivery, 10)
  INTO v_limit, v_max_kg
  FROM public.vendor_subscriptions vs
  JOIN public.vendor_plan_definitions pl ON pl.slug = CASE
    WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
    ELSE vs.tier::text
  END AND pl.is_active
  WHERE vs.store_id = p_store_id;

  IF COALESCE(v_limit, 0) <= 0 THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'no_quota');
  END IF;

  IF v_weight > v_max_kg THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'over_weight', 'max_kg', v_max_kg, 'weight_kg', v_weight);
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('included_delivery:' || p_store_id::text || ':' || v_month)
  );

  SELECT COUNT(*)::int INTO v_used
  FROM public.store_included_delivery_usage u
  WHERE u.store_id = p_store_id AND u.year_month = v_month;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'quota_exhausted', 'used', v_used, 'limit', v_limit);
  END IF;

  INSERT INTO public.store_included_delivery_usage (store_id, order_id, year_month, weight_kg)
  VALUES (p_store_id, p_order_id, v_month, v_weight);

  UPDATE public.orders
  SET included_delivery_credit = true,
      total = CASE
        WHEN COALESCE(last_mile_fee, 0) > 0
             AND last_mile_payment_status IN ('unpaid', 'paid')
        THEN GREATEST(0, total - last_mile_fee)
        ELSE total
      END,
      last_mile_fee = 0
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'consumed', true,
    'remaining', GREATEST(v_limit - v_used - 1, 0),
    'year_month', v_month,
    'weight_kg', v_weight
  );
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.orders
    SET included_delivery_credit = true,
        total = CASE
          WHEN COALESCE(last_mile_fee, 0) > 0
               AND last_mile_payment_status IN ('unpaid', 'paid')
          THEN GREATEST(0, total - last_mile_fee)
          ELSE total
        END,
        last_mile_fee = 0
    WHERE id = p_order_id;
    RETURN jsonb_build_object('consumed', true, 'reason', 'race_already_consumed');
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_included_delivery(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_consume_included_delivery(uuid, uuid, numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.try_consume_included_delivery(uuid, uuid, numeric) IS
  'Consume Enterprise included last-mile credit. Buyer/staff JWT or service_role only.';

-- ---------------------------------------------------------------------------
-- 4) register_hub_storage_arrival — null uid only OK for service_role
--    (preserve signature + restock logic from 155000)
-- ---------------------------------------------------------------------------
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_free_days int;
  v_rate numeric;
  v_free_until timestamptz;
  v_uid uuid := auth.uid();
  v_ok boolean := false;
  v_restock boolean := false;
  v_prior timestamptz;
  v_jwt_role text := nullif(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF p_actor_type IS NULL OR p_actor_type NOT IN ('vendor_inventory', 'buyer_order') THEN
    RAISE EXCEPTION 'invalid actor_type' USING ERRCODE = 'P0001';
  END IF;

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'missing store' USING ERRCODE = 'P0001';
  END IF;

  IF v_uid IS NULL THEN
    v_ok := (v_jwt_role = 'service_role');
  ELSE
    v_ok :=
      EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p_store_id AND s.owner_id = v_uid)
      OR EXISTS (
        SELECT 1 FROM public.store_collaborators sc
        WHERE sc.store_id = p_store_id AND sc.user_id = v_uid AND sc.status = 'active'
      )
      OR public.has_role(v_uid, 'admin'::app_role)
      OR public.has_role(v_uid, 'manager'::app_role);
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_actor_type = 'buyer_order' THEN
    v_free_days := 21;
    v_rate := 1.00;
    IF p_order_id IS NULL THEN
      RAISE EXCEPTION 'buyer_order requires order_id' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_free_days := 14;
    v_rate := 0.59;
  END IF;

  -- Server-side restock detection: prior tracking departed within 14 days
  IF p_actor_type = 'vendor_inventory' AND p_product_id IS NOT NULL THEN
    SELECT t.departed_at INTO v_prior
    FROM public.hub_storage_tracking t
    WHERE t.store_id = p_store_id
      AND t.product_id = p_product_id
      AND t.departed_at IS NOT NULL
    ORDER BY t.departed_at DESC
    LIMIT 1;
    IF v_prior IS NOT NULL AND v_prior > now() - interval '14 days' THEN
      v_restock := true;
    END IF;
  END IF;
  -- Ignore client p_is_restock unless staff
  IF COALESCE(p_is_restock, false)
     AND v_uid IS NOT NULL
     AND (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'manager'::app_role))
  THEN
    v_restock := true;
  END IF;

  IF v_restock THEN
    v_free_until := now() + interval '100 years';
    v_rate := 0;
  ELSE
    v_free_until := now() + make_interval(days => v_free_days);
  END IF;

  INSERT INTO public.hub_storage_tracking (
    store_id, product_id, order_id, actor_type, weight_kg,
    arrived_at, free_until, daily_rate, is_restock, restock_within_free_window
  ) VALUES (
    p_store_id, p_product_id, p_order_id, p_actor_type, COALESCE(p_weight_kg, 0),
    now(), v_free_until, v_rate, v_restock, v_restock
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_hub_storage_arrival(uuid, text, numeric, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_hub_storage_arrival(uuid, text, numeric, uuid, uuid, boolean)
  TO authenticated, service_role;
