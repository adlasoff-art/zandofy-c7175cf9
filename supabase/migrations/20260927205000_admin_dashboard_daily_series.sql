-- Purpose: provide period-driven overview series and compact sales-finance buckets for admin charts.
-- Tables affected: none (reads orders, payment_transactions, disputes, return_requests).
-- Rollback: DROP FUNCTION IF EXISTS public.admin_dashboard_daily_series(timestamptz, text, text);
--           DROP FUNCTION IF EXISTS public.admin_sales_order_buckets(timestamptz, text, text);
--           DROP FUNCTION IF EXISTS public.admin_client_analytics(timestamptz, text, text);
-- Risk (~4000+ users): additive read-only RPC; no user rows or existing schema are changed.

CREATE OR REPLACE FUNCTION public.admin_dashboard_daily_series(
  _since timestamptz DEFAULT NULL,
  _country text DEFAULT NULL,
  _city text DEFAULT NULL
)
RETURNS TABLE (
  day date,
  delivered_count bigint,
  pending_count bigint,
  cancelled_count bigint,
  failed_amount numeric,
  order_amount numeric,
  shipping_amount numeric,
  last_mile_amount numeric,
  mobile_money_gross numeric,
  disputes_count bigint,
  returns_count bigint,
  payments_successful bigint,
  payments_failed bigint,
  payments_pending bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := COALESCE(_since, 'epoch'::timestamptz);
  v_start date;
BEGIN
  IF v_uid IS NULL
     OR NOT (public.has_role(v_uid, 'admin'::public.app_role)
             OR public.has_role(v_uid, 'manager'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT GREATEST(
    v_since::date,
    COALESCE(
      LEAST(
        (SELECT min(created_at)::date FROM public.orders),
        (SELECT min(created_at)::date FROM public.payment_transactions),
        (SELECT min(created_at)::date FROM public.disputes),
        (SELECT min(created_at)::date FROM public.return_requests)
      ),
      CURRENT_DATE
    )
  )
  INTO v_start;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(v_start, CURRENT_DATE, interval '1 day')::date AS day
  ),
  order_daily AS (
    SELECT
      o.created_at::date AS day,
      count(*) FILTER (WHERE o.status = 'delivered') AS delivered_count,
      count(*) FILTER (WHERE o.status = 'pending') AS pending_count,
      count(*) FILTER (WHERE o.status IN ('cancelled', 'returned')) AS cancelled_count,
      COALESCE(sum(o.total) FILTER (WHERE o.status IN ('payment_failed', 'awaiting_payment')), 0) AS failed_amount
    FROM public.orders o
    WHERE o.created_at >= v_since
      AND (_country IS NULL OR o.shipping_country = _country)
      AND (_city IS NULL OR o.shipping_city = _city)
    GROUP BY o.created_at::date
  ),
  payment_daily AS (
    SELECT
      p.created_at::date AS day,
      COALESCE(sum(p.amount) FILTER (
        WHERE p.status IN ('success', 'completed') AND COALESCE(p.payment_type, 'order') = 'order'
      ), 0) AS order_amount,
      COALESCE(sum(p.amount) FILTER (
        WHERE p.status IN ('success', 'completed') AND p.payment_type = 'shipping'
      ), 0) AS shipping_amount,
      COALESCE(sum(p.amount) FILTER (
        WHERE p.status IN ('success', 'completed') AND p.payment_type = 'last_mile'
      ), 0) AS last_mile_amount,
      COALESCE(sum(p.amount) FILTER (
        WHERE p.status IN ('success', 'completed') AND p.method = 'mobile_money'
      ), 0) AS mobile_money_gross,
      count(*) FILTER (WHERE p.status IN ('success', 'completed')) AS payments_successful,
      count(*) FILTER (WHERE p.status = 'failed') AS payments_failed,
      count(*) FILTER (WHERE p.status = 'pending') AS payments_pending
    FROM public.payment_transactions p
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.created_at >= v_since
      AND (_country IS NULL OR o.shipping_country = _country)
      AND (_city IS NULL OR o.shipping_city = _city)
    GROUP BY p.created_at::date
  ),
  dispute_daily AS (
    SELECT d.created_at::date AS day, count(*) AS disputes_count
    FROM public.disputes d
    JOIN public.orders o ON o.id = d.order_id
    WHERE d.created_at >= v_since
      AND (_country IS NULL OR o.shipping_country = _country)
      AND (_city IS NULL OR o.shipping_city = _city)
    GROUP BY d.created_at::date
  ),
  return_daily AS (
    SELECT r.created_at::date AS day, count(*) AS returns_count
    FROM public.return_requests r
    JOIN public.orders o ON o.id = r.order_id
    WHERE r.created_at >= v_since
      AND (_country IS NULL OR o.shipping_country = _country)
      AND (_city IS NULL OR o.shipping_city = _city)
    GROUP BY r.created_at::date
  )
  SELECT
    d.day,
    COALESCE(o.delivered_count, 0),
    COALESCE(o.pending_count, 0),
    COALESCE(o.cancelled_count, 0),
    COALESCE(o.failed_amount, 0),
    COALESCE(p.order_amount, 0),
    COALESCE(p.shipping_amount, 0),
    COALESCE(p.last_mile_amount, 0),
    COALESCE(p.mobile_money_gross, 0),
    COALESCE(di.disputes_count, 0),
    COALESCE(r.returns_count, 0),
    COALESCE(p.payments_successful, 0),
    COALESCE(p.payments_failed, 0),
    COALESCE(p.payments_pending, 0)
  FROM days d
  LEFT JOIN order_daily o USING (day)
  LEFT JOIN payment_daily p USING (day)
  LEFT JOIN dispute_daily di USING (day)
  LEFT JOIN return_daily r USING (day)
  ORDER BY d.day;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_daily_series(timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_daily_series(timestamptz, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_sales_order_buckets(
  _since timestamptz DEFAULT NULL,
  _country text DEFAULT NULL,
  _city text DEFAULT NULL
)
RETURNS TABLE (
  day date,
  store_id uuid,
  status text,
  payment_method text,
  subtotal numeric,
  order_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := COALESCE(_since, 'epoch'::timestamptz);
BEGIN
  IF v_uid IS NULL
     OR NOT (public.has_role(v_uid, 'admin'::public.app_role)
             OR public.has_role(v_uid, 'manager'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.created_at::date,
    o.store_id,
    o.status,
    COALESCE(o.payment_method, 'unknown'),
    COALESCE(sum(o.subtotal), 0),
    count(*)
  FROM public.orders o
  WHERE o.created_at >= v_since
    AND (_country IS NULL OR o.shipping_country = _country)
    AND (_city IS NULL OR o.shipping_city = _city)
  GROUP BY o.created_at::date, o.store_id, o.status, COALESCE(o.payment_method, 'unknown')
  ORDER BY o.created_at::date;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sales_order_buckets(timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sales_order_buckets(timestamptz, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_client_analytics(
  _since timestamptz DEFAULT NULL,
  _country text DEFAULT NULL,
  _city text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := COALESCE(_since, 'epoch'::timestamptz);
  v_result jsonb;
BEGIN
  IF v_uid IS NULL
     OR NOT (public.has_role(v_uid, 'admin'::public.app_role)
             OR public.has_role(v_uid, 'manager'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH signup_daily AS (
    SELECT p.created_at::date AS day, count(*)::bigint AS count
    FROM public.profiles p
    WHERE p.created_at >= v_since
    GROUP BY p.created_at::date
  ),
  referral_daily AS (
    SELECT r.created_at::date AS day, count(*)::bigint AS count
    FROM public.referrals r
    WHERE r.created_at >= v_since
    GROUP BY r.created_at::date
  ),
  spend AS (
    SELECT o.user_id, sum(o.total)::numeric AS spent
    FROM public.orders o
    WHERE o.created_at >= v_since
      AND o.status NOT IN ('awaiting_payment', 'cancelled', 'returned', 'refunded', 'payment_failed')
      AND (_country IS NULL OR o.shipping_country = _country)
      AND (_city IS NULL OR o.shipping_city = _city)
    GROUP BY o.user_id
  ),
  referrers AS (
    SELECT r.referrer_id, count(*)::bigint AS count
    FROM public.referrals r
    WHERE r.created_at >= v_since
    GROUP BY r.referrer_id
  )
  SELECT jsonb_build_object(
    'newClients', (SELECT count(*) FROM public.profiles p WHERE p.created_at >= v_since),
    'buyers', (SELECT count(*) FROM spend),
    'referralCount', (SELECT COALESCE(sum(count), 0) FROM referral_daily),
    'dailySignups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'count', count) ORDER BY day)
      FROM signup_daily
    ), '[]'::jsonb),
    'dailyReferrals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'count', count) ORDER BY day)
      FROM referral_daily
    ), '[]'::jsonb),
    'clients', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.user_id,
        'name', COALESCE(NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Client'),
        'spent', s.spent
      ) ORDER BY s.spent DESC)
      FROM spend s
      LEFT JOIN public.profiles p ON p.id = s.user_id
    ), '[]'::jsonb),
    'referrers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.referrer_id,
        'name', COALESCE(NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Utilisateur'),
        'count', r.count
      ) ORDER BY r.count DESC)
      FROM referrers r
      LEFT JOIN public.profiles p ON p.id = r.referrer_id
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_client_analytics(timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_client_analytics(timestamptz, text, text) TO authenticated;
