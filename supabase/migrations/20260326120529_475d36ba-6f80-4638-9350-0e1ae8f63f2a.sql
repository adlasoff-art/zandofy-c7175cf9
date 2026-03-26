-- Staff (admin/manager) can read ALL orders
CREATE POLICY "Staff read all orders"
ON public.orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Staff can update ALL orders
CREATE POLICY "Staff update all orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Staff can read ALL order items
CREATE POLICY "Staff read all order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Staff can update ALL order items
CREATE POLICY "Staff update all order items"
ON public.order_items FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);