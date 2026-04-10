
-- 1. Fix order_status_history INSERT: remove customer access, keep only staff + store team
DROP POLICY IF EXISTS "Restricted insert order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Authenticated insert order history" ON public.order_status_history;
DROP POLICY IF EXISTS "System insert order history" ON public.order_status_history;

CREATE POLICY "Staff and store team insert order history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR order_id IN (
        SELECT id FROM orders WHERE can_access_store_orders(auth.uid(), store_id)
      )
    )
  );

-- 2. Fix error_reports INSERT: remove anonymous access, require auth + own user_id
DROP POLICY IF EXISTS "Validated error report insert" ON public.error_reports;
DROP POLICY IF EXISTS "Authenticated users can insert error reports" ON public.error_reports;

CREATE POLICY "Authenticated users insert own error reports"
  ON public.error_reports FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- 3. Ensure no sensitive tables remain in Realtime publication (defensive)
DO $$
DECLARE
  t text;
  tables_to_remove text[] := ARRAY[
    'orders','notifications','messages','deliveries','shipments',
    'dispute_messages','support_messages','delivery_chats','order_status_history'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_remove LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
