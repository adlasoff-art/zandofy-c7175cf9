
-- Replace bare WITH CHECK(true) on analytics INSERT policies

-- analytics_events: require non-empty session_id and event_type
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(session_id) > 0
    AND length(event_type) > 0
  );

-- analytics_sessions: require non-empty session_id
DROP POLICY IF EXISTS "Anyone insert analytics sessions" ON public.analytics_sessions;
DROP POLICY IF EXISTS "Anyone can insert analytics sessions" ON public.analytics_sessions;
CREATE POLICY "Anyone can insert analytics sessions"
  ON public.analytics_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(session_id) > 0
  );

-- page_views: require non-empty session_id and page_path
DROP POLICY IF EXISTS "Anyone insert page views" ON public.page_views;
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views"
  ON public.page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(session_id) > 0
    AND length(page_path) > 0
  );
