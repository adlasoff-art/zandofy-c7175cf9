-- ============================================
-- Lot 16 — Analytics Vendeur Pro
-- ============================================

-- ===== 1. KPIs financiers (CA, marge, AOV, CVR) avec comparaison période =====
CREATE OR REPLACE FUNCTION public.vendor_analytics_kpis(
  p_store_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_category_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_payment_method text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_seconds bigint;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_curr jsonb;
  v_prev jsonb;
BEGIN
  IF NOT public.can_access_store_orders(auth.uid(), p_store_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_period_seconds := EXTRACT(EPOCH FROM (p_end - p_start))::bigint;
  v_prev_end := p_start;
  v_prev_start := p_start - make_interval(secs => v_period_seconds);

  WITH curr AS (
    SELECT
      COUNT(DISTINCT o.id) AS orders_count,
      COALESCE(SUM(o.total), 0) AS revenue,
      COALESCE(SUM(oi.quantity * oi.price), 0) AS items_revenue,
      COALESCE(SUM(oi.quantity * COALESCE(p.cost_calc, p.cost_real, 0)), 0) AS cogs,
      COUNT(DISTINCT o.user_id) AS unique_customers
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.store_id = p_store_id
      AND o.created_at >= p_start AND o.created_at < p_end
      AND o.status NOT IN ('cancelled', 'refunded')
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_city IS NULL OR o.shipping_city = p_city)
      AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
  )
  SELECT jsonb_build_object(
    'orders', orders_count,
    'revenue', revenue,
    'gross_margin', items_revenue - cogs,
    'margin_pct', CASE WHEN items_revenue > 0 THEN ROUND((items_revenue - cogs)::numeric / items_revenue * 100, 2) ELSE 0 END,
    'aov', CASE WHEN orders_count > 0 THEN ROUND(revenue::numeric / orders_count, 2) ELSE 0 END,
    'unique_customers', unique_customers
  )
  INTO v_curr FROM curr;

  WITH prev AS (
    SELECT
      COUNT(DISTINCT o.id) AS orders_count,
      COALESCE(SUM(o.total), 0) AS revenue,
      COALESCE(SUM(oi.quantity * oi.price), 0) AS items_revenue,
      COALESCE(SUM(oi.quantity * COALESCE(p.cost_calc, p.cost_real, 0)), 0) AS cogs,
      COUNT(DISTINCT o.user_id) AS unique_customers
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.store_id = p_store_id
      AND o.created_at >= v_prev_start AND o.created_at < v_prev_end
      AND o.status NOT IN ('cancelled', 'refunded')
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_city IS NULL OR o.shipping_city = p_city)
      AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
  )
  SELECT jsonb_build_object(
    'orders', orders_count,
    'revenue', revenue,
    'gross_margin', items_revenue - cogs,
    'aov', CASE WHEN orders_count > 0 THEN ROUND(revenue::numeric / orders_count, 2) ELSE 0 END,
    'unique_customers', unique_customers
  )
  INTO v_prev FROM prev;

  RETURN jsonb_build_object('current', v_curr, 'previous', v_prev);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_analytics_kpis(uuid, timestamptz, timestamptz, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_kpis(uuid, timestamptz, timestamptz, uuid, text, text) TO authenticated;

-- ===== 2. Time series (courbes journalières) =====
CREATE OR REPLACE FUNCTION public.vendor_analytics_timeseries(
  p_store_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_category_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_payment_method text DEFAULT NULL
)
RETURNS TABLE (
  day date,
  orders bigint,
  revenue numeric,
  margin numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_store_orders(auth.uid(), p_store_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_start::date, (p_end - interval '1 day')::date, interval '1 day')::date AS day
  ),
  agg AS (
    SELECT
      o.created_at::date AS day,
      COUNT(DISTINCT o.id) AS orders,
      COALESCE(SUM(o.total), 0) AS revenue,
      COALESCE(SUM(oi.quantity * (oi.price - COALESCE(p.cost_calc, p.cost_real, 0))), 0) AS margin
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.store_id = p_store_id
      AND o.created_at >= p_start AND o.created_at < p_end
      AND o.status NOT IN ('cancelled', 'refunded')
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_city IS NULL OR o.shipping_city = p_city)
      AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
    GROUP BY o.created_at::date
  )
  SELECT d.day, COALESCE(a.orders, 0), COALESCE(a.revenue, 0), COALESCE(a.margin, 0)
  FROM days d LEFT JOIN agg a ON a.day = d.day
  ORDER BY d.day;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_analytics_timeseries(uuid, timestamptz, timestamptz, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_timeseries(uuid, timestamptz, timestamptz, uuid, text, text) TO authenticated;

-- ===== 3. Funnel checkout (vues -> panier -> checkout -> paid) =====
-- Requiert table product_views (déjà existante) et orders. cart_additions = best effort via cart_items si dispo.
CREATE OR REPLACE FUNCTION public.vendor_analytics_funnel(
  p_store_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_views bigint := 0;
  v_carts bigint := 0;
  v_checkouts bigint := 0;
  v_paid bigint := 0;
BEGIN
  IF NOT public.can_access_store_orders(auth.uid(), p_store_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- vues produits
  BEGIN
    SELECT COUNT(*) INTO v_views
    FROM product_views pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.store_id = p_store_id
      AND pv.viewed_at >= p_start AND pv.viewed_at < p_end;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_views := 0;
  END;

  -- ajouts panier (best effort)
  BEGIN
    SELECT COUNT(DISTINCT ci.id) INTO v_carts
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE p.store_id = p_store_id
      AND ci.created_at >= p_start AND ci.created_at < p_end;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_carts := 0;
  END;

  -- checkouts initiés = commandes créées (toutes)
  SELECT COUNT(*) INTO v_checkouts
  FROM orders
  WHERE store_id = p_store_id
    AND created_at >= p_start AND created_at < p_end;

  -- payés = commandes non annulées/remboursées
  SELECT COUNT(*) INTO v_paid
  FROM orders
  WHERE store_id = p_store_id
    AND created_at >= p_start AND created_at < p_end
    AND status NOT IN ('cancelled', 'refunded', 'pending');

  RETURN jsonb_build_object(
    'views', v_views,
    'cart_additions', v_carts,
    'checkouts', v_checkouts,
    'paid', v_paid,
    'view_to_cart_pct', CASE WHEN v_views > 0 THEN ROUND(v_carts::numeric / v_views * 100, 2) ELSE 0 END,
    'cart_to_checkout_pct', CASE WHEN v_carts > 0 THEN ROUND(v_checkouts::numeric / v_carts * 100, 2) ELSE 0 END,
    'checkout_to_paid_pct', CASE WHEN v_checkouts > 0 THEN ROUND(v_paid::numeric / v_checkouts * 100, 2) ELSE 0 END,
    'overall_cvr_pct', CASE WHEN v_views > 0 THEN ROUND(v_paid::numeric / v_views * 100, 2) ELSE 0 END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_analytics_funnel(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_funnel(uuid, timestamptz, timestamptz) TO authenticated;

-- ===== 4. Top produits + alertes stock =====
CREATE OR REPLACE FUNCTION public.vendor_analytics_top_products(
  p_store_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  units_sold bigint,
  revenue numeric,
  margin numeric,
  current_stock int,
  is_low_stock boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_store_orders(auth.uid(), p_store_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(SUM(oi.quantity), 0)::bigint AS units_sold,
    COALESCE(SUM(oi.quantity * oi.price), 0)::numeric AS revenue,
    COALESCE(SUM(oi.quantity * (oi.price - COALESCE(p.cost_calc, p.cost_real, 0))), 0)::numeric AS margin,
    COALESCE(p.stock_quantity, 0)::int,
    COALESCE(p.stock_quantity, 0) > 0 AND COALESCE(p.stock_quantity, 0) <= 5
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  LEFT JOIN orders o ON o.id = oi.order_id
    AND o.created_at >= p_start AND o.created_at < p_end
    AND o.status NOT IN ('cancelled', 'refunded')
  WHERE p.store_id = p_store_id
  GROUP BY p.id, p.name, p.stock_quantity
  ORDER BY revenue DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_analytics_top_products(uuid, timestamptz, timestamptz, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_top_products(uuid, timestamptz, timestamptz, int) TO authenticated;

-- ===== 5. Cohortes mensuelles + LTV + rétention =====
CREATE OR REPLACE FUNCTION public.vendor_analytics_cohorts(
  p_store_id uuid,
  p_months_back int DEFAULT 6
)
RETURNS TABLE (
  cohort_month date,
  customers bigint,
  ltv numeric,
  retention_d30_pct numeric,
  retention_d60_pct numeric,
  retention_d90_pct numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_store_orders(auth.uid(), p_store_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH first_orders AS (
    SELECT user_id, MIN(created_at) AS first_order_at
    FROM orders
    WHERE store_id = p_store_id
      AND status NOT IN ('cancelled', 'refunded')
    GROUP BY user_id
  ),
  cohorts AS (
    SELECT
      date_trunc('month', first_order_at)::date AS cohort_month,
      user_id,
      first_order_at
    FROM first_orders
    WHERE first_order_at >= date_trunc('month', now() - make_interval(months => p_months_back))
  ),
  agg AS (
    SELECT
      c.cohort_month,
      COUNT(DISTINCT c.user_id) AS customers,
      COALESCE(SUM(o.total), 0) AS total_revenue,
      COUNT(DISTINCT CASE WHEN o.created_at BETWEEN c.first_order_at + interval '1 day' AND c.first_order_at + interval '30 days' THEN c.user_id END) AS r30,
      COUNT(DISTINCT CASE WHEN o.created_at BETWEEN c.first_order_at + interval '1 day' AND c.first_order_at + interval '60 days' THEN c.user_id END) AS r60,
      COUNT(DISTINCT CASE WHEN o.created_at BETWEEN c.first_order_at + interval '1 day' AND c.first_order_at + interval '90 days' THEN c.user_id END) AS r90
    FROM cohorts c
    LEFT JOIN orders o ON o.user_id = c.user_id AND o.store_id = p_store_id
      AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY c.cohort_month
  )
  SELECT
    cohort_month,
    customers,
    CASE WHEN customers > 0 THEN ROUND(total_revenue::numeric / customers, 2) ELSE 0 END AS ltv,
    CASE WHEN customers > 0 THEN ROUND(r30::numeric / customers * 100, 2) ELSE 0 END,
    CASE WHEN customers > 0 THEN ROUND(r60::numeric / customers * 100, 2) ELSE 0 END,
    CASE WHEN customers > 0 THEN ROUND(r90::numeric / customers * 100, 2) ELSE 0 END
  FROM agg
  ORDER BY cohort_month DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_analytics_cohorts(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_cohorts(uuid, int) TO authenticated;

-- ===== 6. Export CSV (lignes commandes filtrées) =====
CREATE OR REPLACE FUNCTION public.vendor_analytics_orders_export(
  p_store_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_category_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_payment_method text DEFAULT NULL
)
RETURNS TABLE (
  order_ref text,
  created_at timestamptz,
  status text,
  customer_name text,
  city text,
  payment_method text,
  subtotal numeric,
  shipping_cost numeric,
  total numeric,
  items_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_store_orders(auth.uid(), p_store_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    o.order_ref,
    o.created_at,
    o.status,
    COALESCE(o.shipping_first_name, '') || ' ' || COALESCE(o.shipping_last_name, ''),
    o.shipping_city,
    o.payment_method,
    o.subtotal,
    o.shipping_cost,
    o.total,
    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id)
  FROM orders o
  WHERE o.store_id = p_store_id
    AND o.created_at >= p_start AND o.created_at < p_end
    AND (p_city IS NULL OR o.shipping_city = p_city)
    AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
    AND (p_category_id IS NULL OR EXISTS (
      SELECT 1 FROM order_items oi2
      JOIN products p2 ON p2.id = oi2.product_id
      WHERE oi2.order_id = o.id AND p2.category_id = p_category_id
    ))
  ORDER BY o.created_at DESC
  LIMIT 5000;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_analytics_orders_export(uuid, timestamptz, timestamptz, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_analytics_orders_export(uuid, timestamptz, timestamptz, uuid, text, text) TO authenticated;

-- ===== 7. Table planification rapports email =====
CREATE TABLE IF NOT EXISTS public.vendor_analytics_email_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  format text NOT NULL CHECK (format IN ('csv', 'pdf')),
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 28),
  enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaes_store ON public.vendor_analytics_email_schedules(store_id);
CREATE INDEX IF NOT EXISTS idx_vaes_next_run ON public.vendor_analytics_email_schedules(next_run_at) WHERE enabled = true;

ALTER TABLE public.vendor_analytics_email_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store team manages own analytics schedules"
ON public.vendor_analytics_email_schedules
FOR ALL
TO authenticated
USING (public.can_access_store_orders(auth.uid(), store_id))
WITH CHECK (public.can_access_store_orders(auth.uid(), store_id));

CREATE POLICY "Admins manage all analytics schedules"
ON public.vendor_analytics_email_schedules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_vaes_updated_at
BEFORE UPDATE ON public.vendor_analytics_email_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();