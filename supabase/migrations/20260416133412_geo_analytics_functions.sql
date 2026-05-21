
-- Re-create geo analytics functions in the correct migration path

CREATE OR REPLACE FUNCTION public.get_analytics_top_countries(
  p_since timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(country text, sessions bigint, page_views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ae.country,
    COUNT(DISTINCT ae.session_id) AS sessions,
    COUNT(*) FILTER (WHERE ae.event_type = 'page_view') AS page_views
  FROM analytics_events ae
  WHERE ae.country IS NOT NULL
    AND ae.country != ''
    AND (p_since IS NULL OR ae.created_at >= p_since)
  GROUP BY ae.country
  ORDER BY sessions DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_analytics_top_cities(
  p_since timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(city text, country text, sessions bigint, page_views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ae.city,
    ae.country,
    COUNT(DISTINCT ae.session_id) AS sessions,
    COUNT(*) FILTER (WHERE ae.event_type = 'page_view') AS page_views
  FROM analytics_events ae
  WHERE ae.city IS NOT NULL
    AND ae.city != ''
    AND (p_since IS NULL OR ae.created_at >= p_since)
  GROUP BY ae.city, ae.country
  ORDER BY sessions DESC
  LIMIT p_limit;
$$;

-- Grant execute to both roles
GRANT EXECUTE ON FUNCTION public.get_analytics_top_countries(timestamp with time zone, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_top_cities(timestamp with time zone, integer) TO authenticated, anon;
