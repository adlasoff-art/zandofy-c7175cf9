-- Purpose: Cap avg session duration; add traffic source / referrer / trending search RPCs.
-- Tables affected: analytics_events (read-only aggregations; no schema DROP).
-- Rollback: re-apply prior get_analytics_kpis definition from 20260414112644; DROP new functions.

-- 1) KPIs — avg_duration capped at 30 minutes (1800s), ignore non-positive durations
CREATE OR REPLACE FUNCTION public.get_analytics_kpis(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'unique_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE (p_since IS NULL OR created_at >= p_since)),
    'page_views', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'page_view' AND (p_since IS NULL OR created_at >= p_since)),
    'authenticated_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE user_id IS NOT NULL AND (p_since IS NULL OR created_at >= p_since)),
    'anonymous_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE user_id IS NULL AND (p_since IS NULL OR created_at >= p_since)),
    'avg_duration', (
      SELECT COALESCE(ROUND(AVG(LEAST(duration_seconds, 1800))), 0)
      FROM analytics_events
      WHERE event_type = 'session_end'
        AND duration_seconds IS NOT NULL
        AND duration_seconds > 0
        AND (p_since IS NULL OR created_at >= p_since)
    ),
    'product_clicks', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'product_click' AND (p_since IS NULL OR created_at >= p_since)),
    'pwa_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE is_pwa = true AND (p_since IS NULL OR created_at >= p_since)),
    'web_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE (is_pwa IS NULL OR is_pwa = false) AND (p_since IS NULL OR created_at >= p_since)),
    'online_now', (SELECT COUNT(*) FROM profiles WHERE is_online = true AND last_seen_at > now() - interval '2 minutes'),
    'accounts_created', (SELECT COUNT(*) FROM profiles WHERE (p_since IS NULL OR created_at >= p_since))
  );
$function$;

-- 2) Traffic sources from session_start metadata (with fallback from is_pwa + referrer)
CREATE OR REPLACE FUNCTION public.get_analytics_traffic_sources(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(source_class text, session_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH starts AS (
    SELECT DISTINCT ON (session_id)
      session_id,
      is_pwa,
      referrer,
      metadata
    FROM analytics_events
    WHERE event_type = 'session_start'
      AND (p_since IS NULL OR created_at >= p_since)
    ORDER BY session_id, created_at ASC
  ),
  classified AS (
    SELECT
      session_id,
      CASE
        WHEN COALESCE(metadata->>'source_class', '') <> '' THEN metadata->>'source_class'
        WHEN is_pwa IS TRUE THEN 'pwa'
        WHEN referrer IS NOT NULL AND referrer <> '' AND (
          referrer ILIKE '%google.%' OR referrer ILIKE '%bing.%' OR referrer ILIKE '%yahoo.%'
          OR referrer ILIKE '%duckduckgo.%' OR referrer ILIKE '%baidu.%'
        ) THEN 'search'
        WHEN referrer IS NOT NULL AND referrer <> '' AND (
          referrer ILIKE '%facebook.%' OR referrer ILIKE '%instagram.%' OR referrer ILIKE '%twitter.%'
          OR referrer ILIKE '%t.co%' OR referrer ILIKE '%linkedin.%' OR referrer ILIKE '%tiktok.%'
          OR referrer ILIKE '%whatsapp.%' OR referrer ILIKE '%t.me%' OR referrer ILIKE '%youtube.%'
        ) THEN 'social'
        WHEN referrer IS NOT NULL AND referrer <> ''
          AND referrer NOT ILIKE '%zandofy.com%'
          AND referrer NOT ILIKE '%localhost%'
        THEN 'referral'
        ELSE 'direct'
      END AS source_class
    FROM starts
  )
  SELECT c.source_class, COUNT(*)::bigint AS session_count
  FROM classified c
  GROUP BY c.source_class
  ORDER BY session_count DESC;
$function$;

-- 3) Top external referrer hosts
CREATE OR REPLACE FUNCTION public.get_analytics_top_referrers(
  p_since timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 20
)
 RETURNS TABLE(referrer_host text, session_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH starts AS (
    SELECT DISTINCT ON (session_id)
      session_id,
      referrer
    FROM analytics_events
    WHERE event_type = 'session_start'
      AND referrer IS NOT NULL
      AND referrer <> ''
      AND (p_since IS NULL OR created_at >= p_since)
    ORDER BY session_id, created_at ASC
  ),
  hosts AS (
    SELECT
      session_id,
      lower(
        regexp_replace(
          regexp_replace(referrer, '^https?://', '', 'i'),
          '/.*$',
          ''
        )
      ) AS referrer_host
    FROM starts
  )
  SELECT h.referrer_host, COUNT(*)::bigint AS session_count
  FROM hosts h
  WHERE h.referrer_host IS NOT NULL
    AND h.referrer_host <> ''
    AND h.referrer_host NOT LIKE '%zandofy.com%'
    AND h.referrer_host NOT LIKE 'localhost%'
    AND h.referrer_host NOT LIKE '127.0.0.1%'
  GROUP BY h.referrer_host
  ORDER BY session_count DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$function$;

-- 4) Trending search queries (min 2 occurrences)
CREATE OR REPLACE FUNCTION public.get_trending_searches(
  p_since timestamp with time zone DEFAULT (now() - interval '7 days'),
  p_limit integer DEFAULT 10
)
 RETURNS TABLE(query text, search_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    lower(trim(COALESCE(metadata->>'query', ''))) AS query,
    COUNT(*)::bigint AS search_count
  FROM analytics_events
  WHERE event_type = 'search'
    AND (p_since IS NULL OR created_at >= p_since)
    AND COALESCE(metadata->>'query', '') <> ''
    AND char_length(trim(metadata->>'query')) >= 2
  GROUP BY lower(trim(COALESCE(metadata->>'query', '')))
  HAVING COUNT(*) >= 2
  ORDER BY search_count DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$function$;

GRANT EXECUTE ON FUNCTION public.get_analytics_kpis(timestamp with time zone) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_traffic_sources(timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_analytics_top_referrers(timestamp with time zone, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_searches(timestamp with time zone, integer) TO authenticated, anon;
