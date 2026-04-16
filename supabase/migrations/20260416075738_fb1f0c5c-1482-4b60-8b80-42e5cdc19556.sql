
-- Top countries by unique sessions
CREATE OR REPLACE FUNCTION public.get_analytics_top_countries(p_since timestamp with time zone DEFAULT NULL)
RETURNS TABLE(country text, session_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ae.country,
    COUNT(DISTINCT ae.session_id) AS session_count
  FROM analytics_events ae
  WHERE ae.country IS NOT NULL AND ae.country != ''
    AND (p_since IS NULL OR ae.created_at >= p_since)
  GROUP BY ae.country
  ORDER BY session_count DESC
  LIMIT 50;
$$;

-- Top cities by unique sessions
CREATE OR REPLACE FUNCTION public.get_analytics_top_cities(p_since timestamp with time zone DEFAULT NULL)
RETURNS TABLE(city text, country text, session_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ae.city,
    ae.country,
    COUNT(DISTINCT ae.session_id) AS session_count
  FROM analytics_events ae
  WHERE ae.city IS NOT NULL AND ae.city != ''
    AND (p_since IS NULL OR ae.created_at >= p_since)
  GROUP BY ae.city, ae.country
  ORDER BY session_count DESC
  LIMIT 50;
$$;

-- Grant execute to authenticated users (admin check is done at app level)
GRANT EXECUTE ON FUNCTION public.get_analytics_top_countries(timestamp with time zone) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_top_cities(timestamp with time zone) TO authenticated, anon;
