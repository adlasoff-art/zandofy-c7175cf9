
-- Fix permissive INSERT policy on order_status_history
DROP POLICY "System insert order history" ON public.order_status_history;

CREATE POLICY "Authenticated insert order history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- User owns the order
      order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
      -- Or store owner
      OR order_id IN (SELECT id FROM orders WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
      -- Or staff
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );
