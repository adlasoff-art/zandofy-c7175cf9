
-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_composite
ON public.analytics_events (created_at, event_type, session_id);

-- KPIs function
CREATE OR REPLACE FUNCTION public.get_analytics_kpis(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'unique_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE (p_since IS NULL OR created_at >= p_since)),
    'page_views', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'page_view' AND (p_since IS NULL OR created_at >= p_since)),
    'authenticated_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE user_id IS NOT NULL AND (p_since IS NULL OR created_at >= p_since)),
    'anonymous_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE user_id IS NULL AND (p_since IS NULL OR created_at >= p_since)),
    'avg_duration', (SELECT COALESCE(ROUND(AVG(duration_seconds)), 0) FROM analytics_events WHERE event_type = 'session_end' AND duration_seconds IS NOT NULL AND (p_since IS NULL OR created_at >= p_since)),
    'product_clicks', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'product_click' AND (p_since IS NULL OR created_at >= p_since)),
    'pwa_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE is_pwa = true AND (p_since IS NULL OR created_at >= p_since)),
    'web_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE (is_pwa IS NULL OR is_pwa = false) AND (p_since IS NULL OR created_at >= p_since)),
    'online_now', (SELECT COUNT(*) FROM profiles WHERE is_online = true AND last_seen_at > now() - interval '2 minutes')
  );
$$;

-- Daily traffic function with full date series
CREATE OR REPLACE FUNCTION public.get_analytics_daily_traffic(p_since timestamptz DEFAULT NULL)
RETURNS TABLE(day date, visitors bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH date_range AS (
    SELECT COALESCE(p_since::date, (SELECT MIN(created_at)::date FROM analytics_events)) AS start_date,
           CURRENT_DATE AS end_date
  ),
  all_days AS (
    SELECT generate_series(
      (SELECT start_date FROM date_range),
      (SELECT end_date FROM date_range),
      '1 day'::interval
    )::date AS day
  ),
  daily_counts AS (
    SELECT created_at::date AS day, COUNT(DISTINCT session_id) AS visitors
    FROM analytics_events
    WHERE (p_since IS NULL OR created_at >= p_since)
    GROUP BY created_at::date
  )
  SELECT ad.day, COALESCE(dc.visitors, 0) AS visitors
  FROM all_days ad
  LEFT JOIN daily_counts dc ON dc.day = ad.day
  ORDER BY ad.day;
$$;

-- Top products with real names
CREATE OR REPLACE FUNCTION public.get_analytics_top_products(p_since timestamptz DEFAULT NULL, p_limit int DEFAULT 10)
RETURNS TABLE(product_id uuid, product_name text, click_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ae.product_id,
    COALESCE(p.name, 'Produit supprimé (' || LEFT(ae.product_id::text, 8) || ')') AS product_name,
    COUNT(*) AS click_count
  FROM analytics_events ae
  LEFT JOIN products p ON p.id = ae.product_id
  WHERE ae.event_type = 'product_click'
    AND ae.product_id IS NOT NULL
    AND (p_since IS NULL OR ae.created_at >= p_since)
  GROUP BY ae.product_id, p.name
  ORDER BY click_count DESC
  LIMIT p_limit;
$$;

-- Top stores with real names
CREATE OR REPLACE FUNCTION public.get_analytics_top_stores(p_since timestamptz DEFAULT NULL, p_limit int DEFAULT 10)
RETURNS TABLE(store_id uuid, store_name text, view_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ae.store_id,
    COALESCE(s.name, 'Boutique supprimée (' || LEFT(ae.store_id::text, 8) || ')') AS store_name,
    COUNT(*) AS view_count
  FROM analytics_events ae
  LEFT JOIN stores s ON s.id = ae.store_id
  WHERE ae.event_type = 'store_view'
    AND ae.store_id IS NOT NULL
    AND (p_since IS NULL OR ae.created_at >= p_since)
  GROUP BY ae.store_id, s.name
  ORDER BY view_count DESC
  LIMIT p_limit;
$$;

-- Top pages
CREATE OR REPLACE FUNCTION public.get_analytics_top_pages(p_since timestamptz DEFAULT NULL, p_limit int DEFAULT 10)
RETURNS TABLE(page_path text, view_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(page_path, '/') AS page_path,
    COUNT(*) AS view_count
  FROM analytics_events
  WHERE event_type = 'page_view'
    AND (p_since IS NULL OR created_at >= p_since)
  GROUP BY page_path
  ORDER BY view_count DESC
  LIMIT p_limit;
$$;

-- Device & OS breakdown
CREATE OR REPLACE FUNCTION public.get_analytics_devices(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH session_devices AS (
    SELECT DISTINCT ON (session_id)
      session_id,
      COALESCE(device_type, 'desktop') AS device_type,
      os
    FROM analytics_events
    WHERE (p_since IS NULL OR created_at >= p_since)
    ORDER BY session_id, created_at
  )
  SELECT jsonb_build_object(
    'devices', (
      SELECT jsonb_object_agg(device_type, cnt)
      FROM (SELECT device_type, COUNT(*) AS cnt FROM session_devices GROUP BY device_type) sub
    ),
    'os', (
      SELECT jsonb_object_agg(COALESCE(os, 'unknown'), cnt)
      FROM (SELECT os, COUNT(*) AS cnt FROM session_devices WHERE os IS NOT NULL GROUP BY os) sub
    )
  );
$$;
