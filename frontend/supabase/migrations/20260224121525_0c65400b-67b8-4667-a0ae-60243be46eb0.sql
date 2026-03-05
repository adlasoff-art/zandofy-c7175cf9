
-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  store_id UUID REFERENCES public.stores(id),
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  shipping_first_name TEXT,
  shipping_last_name TEXT,
  shipping_email TEXT,
  shipping_phone TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_country TEXT,
  shipping_postal_code TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  order_ref TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_image TEXT,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  size TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Users can read their own orders
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (user_id = auth.uid());

-- Users can create their own orders
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT WITH CHECK (user_id = auth.uid());

-- Store owners can read orders for their store
CREATE POLICY "Store owners read orders" ON public.orders FOR SELECT
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Store owners can update order status
CREATE POLICY "Store owners update orders" ON public.orders FOR UPDATE
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Order items: users read own
CREATE POLICY "Users read own order items" ON public.order_items FOR SELECT
USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

-- Order items: users insert own
CREATE POLICY "Users insert own order items" ON public.order_items FOR INSERT
WITH CHECK (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

-- Order items: store owners read
CREATE POLICY "Store owners read order items" ON public.order_items FOR SELECT
USING (order_id IN (SELECT id FROM orders WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
