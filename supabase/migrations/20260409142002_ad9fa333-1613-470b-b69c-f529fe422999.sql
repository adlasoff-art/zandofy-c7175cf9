-- A1: Sécuriser order_status_history INSERT
DROP POLICY IF EXISTS "Authenticated insert order history" ON public.order_status_history;

CREATE POLICY "Restricted insert order history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR order_id IN (
        SELECT id FROM public.orders WHERE public.can_access_store_orders(auth.uid(), store_id)
      )
    )
  );

-- A2: Sécuriser error_reports INSERT
DROP POLICY IF EXISTS "Anyone can report errors" ON public.error_reports;

CREATE POLICY "Validated error report insert"
  ON public.error_reports FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );

-- A3: Renforcer analytics_events INSERT
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

CREATE POLICY "Validated analytics event insert"
  ON public.analytics_events FOR INSERT
  WITH CHECK (
    length(session_id) > 0
    AND length(event_type) > 0
    AND (user_id IS NULL OR user_id = auth.uid())
  );