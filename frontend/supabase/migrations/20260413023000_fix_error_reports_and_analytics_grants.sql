-- ============================================================
-- Zandofy — Fix error reporting + analytics permissions
-- Apply on: Zandofy-production AND Zandofy-live-production
-- Date: 2026-04-13
-- ============================================================

-- 1. Fix error_reports INSERT policy (allow anonymous error reports)
DROP POLICY IF EXISTS "Authenticated users insert own error reports" ON public.error_reports;

CREATE POLICY "Anyone can insert error reports"
ON public.error_reports FOR INSERT
TO anon, authenticated
WITH CHECK (
  CASE
    WHEN auth.uid() IS NOT NULL THEN user_id = auth.uid()
    ELSE user_id IS NULL
  END
);

-- 2. Ensure analytics RPC functions are callable
GRANT EXECUTE ON FUNCTION public.get_analytics_kpis(timestamp with time zone) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_daily_traffic(timestamp with time zone) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_top_products(timestamp with time zone, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_top_stores(timestamp with time zone, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_top_pages(timestamp with time zone, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_devices(timestamp with time zone) TO authenticated, anon;
