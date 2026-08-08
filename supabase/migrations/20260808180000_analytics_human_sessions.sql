-- Purpose: Allow human_session events; expose human_sessions KPI (interaction-gated).
-- Tables affected: analytics_events (policy + RPC read aggregations only).
-- Rollback: restore prior INSERT policy without human_session; re-apply prior get_analytics_kpis.

-- 1) Allow human_session inserts from anon/authenticated
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IN (
    'page_view',
    'page_view_end',
    'product_click',
    'product_view',
    'store_view',
    'pwa_install',
    'session_start',
    'session_end',
    'human_session',
    'search',
    'add_to_cart',
    'checkout_start',
    'purchase'
  )
  AND char_length(session_id) BETWEEN 8 AND 128
  AND (page_path IS NULL OR char_length(page_path) <= 500)
  AND (referrer IS NULL OR char_length(referrer) <= 2000)
);

-- 2) KPIs — unique_sessions = brut; human_sessions = interaction-gated
CREATE OR REPLACE FUNCTION public.get_analytics_kpis(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'unique_sessions', (SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE (p_since IS NULL OR created_at >= p_since)),
    'human_sessions', (
      SELECT COUNT(DISTINCT session_id)
      FROM analytics_events
      WHERE event_type = 'human_session'
        AND (p_since IS NULL OR created_at >= p_since)
    ),
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

GRANT EXECUTE ON FUNCTION public.get_analytics_kpis(timestamp with time zone) TO authenticated, anon;
