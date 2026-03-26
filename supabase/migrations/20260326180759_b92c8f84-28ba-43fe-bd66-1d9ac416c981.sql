
-- ============================================================
-- FIX: Order visibility for all roles (client, vendor, admin)
-- Idempotent migration
-- ============================================================

-- 1. Create the helper function can_access_store_orders
CREATE OR REPLACE FUNCTION public.can_access_store_orders(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.store_collaborators sc
    WHERE sc.store_id = _store_id AND sc.user_id = _user_id AND sc.status = 'active'
  )
$$;

-- 2. Drop ALL existing SELECT/INSERT/UPDATE policies on orders to rebuild cleanly
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
DROP POLICY IF EXISTS "Store owners read orders" ON public.orders;
DROP POLICY IF EXISTS "Store owners update orders" ON public.orders;
DROP POLICY IF EXISTS "Store team read orders" ON public.orders;
DROP POLICY IF EXISTS "Store team update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff read all orders" ON public.orders;
DROP POLICY IF EXISTS "Staff update all orders" ON public.orders;
DROP POLICY IF EXISTS "Users cancel own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update delivery choice on own orders" ON public.orders;

-- 3. Recreate all policies with TO authenticated

-- Customers read their own orders
CREATE POLICY "Users read own orders"
ON public.orders FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Customers create their own orders
CREATE POLICY "Users create own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Customers cancel own pending/confirmed orders
CREATE POLICY "Users cancel own orders"
ON public.orders FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status IN ('pending', 'confirmed'))
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- Customers update delivery choice on own orders
CREATE POLICY "Users can update delivery choice on own orders"
ON public.orders FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Store team (owner + active collaborators) read orders
CREATE POLICY "Store team read orders"
ON public.orders FOR SELECT TO authenticated
USING (public.can_access_store_orders(auth.uid(), store_id));

-- Store team update orders
CREATE POLICY "Store team update orders"
ON public.orders FOR UPDATE TO authenticated
USING (public.can_access_store_orders(auth.uid(), store_id));

-- Admin/Manager read all orders
CREATE POLICY "Staff read all orders"
ON public.orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Admin/Manager update all orders
CREATE POLICY "Staff update all orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- 4. Fix order_items policies
DROP POLICY IF EXISTS "Users read own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users insert own order items" ON public.order_items;
DROP POLICY IF EXISTS "Store owners read order items" ON public.order_items;
DROP POLICY IF EXISTS "Store team read order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff read all order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff update all order items" ON public.order_items;

CREATE POLICY "Users read own order items"
ON public.order_items FOR SELECT TO authenticated
USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Users insert own order items"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Store team read order items"
ON public.order_items FOR SELECT TO authenticated
USING (order_id IN (
  SELECT id FROM public.orders WHERE public.can_access_store_orders(auth.uid(), store_id)
));

CREATE POLICY "Staff read all order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Staff update all order items"
ON public.order_items FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- 5. Fix order_status_history policies
DROP POLICY IF EXISTS "Users read own order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Store owners read order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Store team read order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Staff read all order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Authenticated insert order history" ON public.order_status_history;

CREATE POLICY "Users read own order history"
ON public.order_status_history FOR SELECT TO authenticated
USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Store team read order history"
ON public.order_status_history FOR SELECT TO authenticated
USING (order_id IN (
  SELECT id FROM public.orders WHERE public.can_access_store_orders(auth.uid(), store_id)
));

CREATE POLICY "Staff read all order history"
ON public.order_status_history FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Authenticated insert order history"
ON public.order_status_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
