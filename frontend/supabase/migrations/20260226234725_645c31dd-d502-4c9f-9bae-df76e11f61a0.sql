
-- Restrict badge request approval to admin only (not manager)
DROP POLICY IF EXISTS "Staff update badge requests" ON public.badge_requests;
CREATE POLICY "Admin update badge requests"
ON public.badge_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
