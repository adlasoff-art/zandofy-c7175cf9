-- Allow admins and managers to INSERT categories
CREATE POLICY "Staff can insert categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- Allow admins and managers to UPDATE categories
CREATE POLICY "Staff can update categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- Allow admins and managers to DELETE categories
CREATE POLICY "Staff can delete categories"
ON public.categories
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);