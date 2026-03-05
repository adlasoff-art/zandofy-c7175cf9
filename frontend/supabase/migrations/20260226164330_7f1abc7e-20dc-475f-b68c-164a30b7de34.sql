-- Allow admins and managers to insert stores (for vendor approval flow)
CREATE POLICY "Staff can insert stores"
ON public.stores
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Allow admins to delete stores
CREATE POLICY "Staff can delete stores"
ON public.stores
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));