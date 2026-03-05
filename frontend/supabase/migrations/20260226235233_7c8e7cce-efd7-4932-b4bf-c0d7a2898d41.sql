
-- Allow users to update their own orders (for cancellation)
CREATE POLICY "Users cancel own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status IN ('pending', 'confirmed'))
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');
