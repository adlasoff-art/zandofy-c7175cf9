-- Purpose: Buyer-safe preview of Enterprise included last-mile credit (no consume).
-- Risk: low read-only. Used at checkout before payment.
-- Staging → production: after 20261001151000 / 155000.

CREATE OR REPLACE FUNCTION public.preview_included_delivery_credit(
  p_store_id uuid,
  p_weight_kg numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quota jsonb;
  v_limit int;
  v_used int;
  v_max_kg numeric;
  v_month text;
  v_weight numeric := COALESCE(p_weight_kg, 0);
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'eligible', false, 'reason', 'missing_store');
  END IF;

  -- Reuse quota internals without ownership gate (checkout buyers need this)
  v_month := to_char(timezone('utc', now()), 'YYYY-MM');
  SELECT COALESCE(p.included_deliveries_per_month, 0),
         COALESCE(p.max_kg_per_included_delivery, 10)
  INTO v_limit, v_max_kg
  FROM public.vendor_subscriptions vs
  JOIN public.vendor_plan_definitions p ON p.slug = CASE
    WHEN vs.tier::text = 'grand_supplier' THEN 'enterprise'
    ELSE vs.tier::text
  END AND p.is_active
  WHERE vs.store_id = p_store_id;

  IF COALESCE(v_limit, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'ok', true, 'eligible', false, 'reason', 'no_quota',
      'limit', 0, 'used', 0, 'remaining', 0, 'max_kg', COALESCE(v_max_kg, 10)
    );
  END IF;

  SELECT COUNT(*)::int INTO v_used
  FROM public.store_included_delivery_usage u
  WHERE u.store_id = p_store_id AND u.year_month = v_month;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'ok', true, 'eligible', false, 'reason', 'quota_exhausted',
      'limit', v_limit, 'used', v_used, 'remaining', 0, 'max_kg', v_max_kg, 'year_month', v_month
    );
  END IF;

  IF v_weight > v_max_kg THEN
    RETURN jsonb_build_object(
      'ok', true, 'eligible', false, 'reason', 'over_weight',
      'limit', v_limit, 'used', v_used, 'remaining', GREATEST(v_limit - v_used, 0),
      'max_kg', v_max_kg, 'weight_kg', v_weight, 'year_month', v_month
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'eligible', true, 'reason', 'available',
    'limit', v_limit, 'used', v_used, 'remaining', GREATEST(v_limit - v_used, 0),
    'max_kg', v_max_kg, 'weight_kg', v_weight, 'year_month', v_month
  );
END;
$$;

COMMENT ON FUNCTION public.preview_included_delivery_credit(uuid, numeric) IS
  'Read-only: whether an included last-mile credit would apply (no consume).';

REVOKE ALL ON FUNCTION public.preview_included_delivery_credit(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_included_delivery_credit(uuid, numeric) TO anon, authenticated;
