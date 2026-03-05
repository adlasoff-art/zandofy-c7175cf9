
-- Add can_create_coupons flag to stores table
ALTER TABLE public.stores ADD COLUMN can_create_coupons boolean NOT NULL DEFAULT false;

-- Add admin CRUD policies for global coupons table
CREATE POLICY "Staff manage coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
