-- =============================================================================
-- Lot 11B Phase B9 — Suivi qualité opérateurs
-- =============================================================================

-- 1. Colonnes de score sur delivery_operators -------------------------------
ALTER TABLE public.delivery_operators
  ADD COLUMN IF NOT EXISTS reliability_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS reliability_window_days integer,
  ADD COLUMN IF NOT EXISTS reliability_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_suspension_reason text;

-- 2. Table de seuils (single-row) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_operator_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  window_days integer NOT NULL DEFAULT 30 CHECK (window_days BETWEEN 7 AND 180),
  min_assignments integer NOT NULL DEFAULT 10 CHECK (min_assignments >= 1),
  min_score numeric(5,2) NOT NULL DEFAULT 50.00 CHECK (min_score BETWEEN 0 AND 100),
  max_expiry_rate_pct numeric(5,2) NOT NULL DEFAULT 25.00 CHECK (max_expiry_rate_pct BETWEEN 0 AND 100),
  max_decline_rate_pct numeric(5,2) NOT NULL DEFAULT 50.00 CHECK (max_decline_rate_pct BETWEEN 0 AND 100),
  auto_suspend_enabled boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.delivery_operator_thresholds DEFAULT VALUES
ON CONFLICT DO NOTHING;

ALTER TABLE public.delivery_operator_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thresholds read admin/manager" ON public.delivery_operator_thresholds;
CREATE POLICY "thresholds read admin/manager"
ON public.delivery_operator_thresholds
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

DROP POLICY IF EXISTS "thresholds write admin" ON public.delivery_operator_thresholds;
CREATE POLICY "thresholds write admin"
ON public.delivery_operator_thresholds
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. Fonction de calcul KPI + score ----------------------------------------
CREATE OR REPLACE FUNCTION public.compute_operator_reliability(
  p_operator_id uuid,
  p_window_days integer DEFAULT 30
)
RETURNS TABLE (
  operator_id uuid,
  window_days integer,
  total_assignments bigint,
  accepted_count bigint,
  declined_count bigint,
  expired_count bigint,
  pending_count bigint,
  acceptance_rate numeric,
  decline_rate numeric,
  expiry_rate numeric,
  avg_response_minutes numeric,
  delivered_count bigint,
  customer_rating_avg numeric,
  customer_rating_count bigint,
  score numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (p_window_days || ' days')::interval;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      o.id AS order_id,
      o.operator_acceptance_status,
      o.operator_assigned_at,
      o.operator_responded_at,
      o.status AS order_status
    FROM public.orders o
    WHERE o.delivery_operator_id = p_operator_id
      AND o.operator_assigned_at IS NOT NULL
      AND o.operator_assigned_at >= v_since
  ),
  agg AS (
    SELECT
      COUNT(*)::bigint AS total_assignments,
      COUNT(*) FILTER (WHERE operator_acceptance_status = 'accepted')::bigint AS accepted_count,
      COUNT(*) FILTER (WHERE operator_acceptance_status = 'declined')::bigint AS declined_count,
      COUNT(*) FILTER (WHERE operator_acceptance_status = 'expired')::bigint AS expired_count,
      COUNT(*) FILTER (WHERE operator_acceptance_status = 'pending')::bigint AS pending_count,
      COUNT(*) FILTER (WHERE order_status = 'delivered')::bigint AS delivered_count,
      AVG(EXTRACT(EPOCH FROM (operator_responded_at - operator_assigned_at)) / 60.0)
        FILTER (WHERE operator_responded_at IS NOT NULL) AS avg_response_minutes
    FROM base
  ),
  ratings AS (
    SELECT
      AVG(cr.rating)::numeric AS customer_rating_avg,
      COUNT(*)::bigint AS customer_rating_count
    FROM public.customer_ratings cr
    JOIN public.orders o ON o.id = cr.order_id
    WHERE o.delivery_operator_id = p_operator_id
      AND cr.created_at >= v_since
  )
  SELECT
    p_operator_id,
    p_window_days,
    a.total_assignments,
    a.accepted_count,
    a.declined_count,
    a.expired_count,
    a.pending_count,
    CASE WHEN a.total_assignments > 0
         THEN ROUND((a.accepted_count::numeric / a.total_assignments) * 100, 2)
         ELSE 0 END AS acceptance_rate,
    CASE WHEN a.total_assignments > 0
         THEN ROUND((a.declined_count::numeric / a.total_assignments) * 100, 2)
         ELSE 0 END AS decline_rate,
    CASE WHEN a.total_assignments > 0
         THEN ROUND((a.expired_count::numeric / a.total_assignments) * 100, 2)
         ELSE 0 END AS expiry_rate,
    ROUND(COALESCE(a.avg_response_minutes, 0)::numeric, 2),
    a.delivered_count,
    ROUND(COALESCE(r.customer_rating_avg, 0), 2),
    r.customer_rating_count,
    -- Score 0-100 : Acceptation (50) + Anti-expiration (30) + Note client (20)
    -- Si pas de données, score = NULL (ne pénalise pas un opérateur sans assignation)
    CASE
      WHEN a.total_assignments = 0 THEN NULL
      ELSE ROUND(
        LEAST(100,
          (a.accepted_count::numeric / NULLIF(a.total_assignments,0)) * 50
          + (1 - (a.expired_count::numeric / NULLIF(a.total_assignments,0))) * 30
          + COALESCE(r.customer_rating_avg, 4) / 5.0 * 20
        ), 2)
    END AS score
  FROM agg a CROSS JOIN ratings r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_operator_reliability(uuid, integer) TO authenticated;

-- 4. Fonction refresh : calcule pour TOUS les opérateurs et persiste -------
CREATE OR REPLACE FUNCTION public.refresh_all_operator_reliability()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window integer;
  v_count integer := 0;
  rec RECORD;
  v_score numeric;
BEGIN
  SELECT window_days INTO v_window
  FROM public.delivery_operator_thresholds
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1;
  v_window := COALESCE(v_window, 30);

  FOR rec IN SELECT id FROM public.delivery_operators WHERE status = 'approved' LOOP
    SELECT score INTO v_score
    FROM public.compute_operator_reliability(rec.id, v_window);

    UPDATE public.delivery_operators
       SET reliability_score = v_score,
           reliability_window_days = v_window,
           reliability_computed_at = now(),
           updated_at = now()
     WHERE id = rec.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_all_operator_reliability() TO authenticated;

-- 5. Vue consolidée KPIs courants ------------------------------------------
CREATE OR REPLACE VIEW public.v_operator_performance
WITH (security_invoker = true)
AS
SELECT
  o.id AS operator_id,
  o.company_name,
  o.is_platform_owned,
  o.is_active,
  o.status,
  o.reliability_score,
  o.reliability_window_days,
  o.reliability_computed_at,
  o.auto_suspended_at,
  o.auto_suspension_reason,
  o.rating_avg,
  o.total_deliveries,
  k.total_assignments,
  k.accepted_count,
  k.declined_count,
  k.expired_count,
  k.pending_count,
  k.acceptance_rate,
  k.decline_rate,
  k.expiry_rate,
  k.avg_response_minutes,
  k.delivered_count,
  k.customer_rating_avg,
  k.customer_rating_count
FROM public.delivery_operators o
LEFT JOIN LATERAL (
  SELECT * FROM public.compute_operator_reliability(
    o.id,
    COALESCE(o.reliability_window_days, 30)
  )
) k ON true
WHERE
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'manager')
  OR o.owner_user_id = auth.uid();

GRANT SELECT ON public.v_operator_performance TO authenticated;

-- 6. Trigger updated_at sur thresholds -------------------------------------
DROP TRIGGER IF EXISTS trg_thresholds_updated_at ON public.delivery_operator_thresholds;
CREATE TRIGGER trg_thresholds_updated_at
BEFORE UPDATE ON public.delivery_operator_thresholds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();