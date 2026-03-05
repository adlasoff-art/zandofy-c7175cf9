
-- =============================================
-- Phase 1: Vendor Subscription Tiers & Feature Gating
-- =============================================

-- Enum for vendor tiers
CREATE TYPE public.vendor_tier AS ENUM ('beginner', 'pro', 'grand_supplier');

-- Enum for product publish status
CREATE TYPE public.product_status AS ENUM ('draft', 'pending_approval', 'published', 'rejected');

-- Vendor subscriptions table
CREATE TABLE public.vendor_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tier vendor_tier NOT NULL DEFAULT 'beginner',
  max_products INTEGER NOT NULL DEFAULT 10,
  is_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  can_self_deliver BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT DEFAULT NULL,
  paid_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;

-- Public read (needed to check limits on product pages)
CREATE POLICY "Public read vendor subscriptions"
  ON public.vendor_subscriptions FOR SELECT
  USING (true);

-- Store owners can read their own
CREATE POLICY "Store owners update own subscription"
  ON public.vendor_subscriptions FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Staff can manage all
CREATE POLICY "Staff manage subscriptions"
  ON public.vendor_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_vendor_subscriptions_updated_at
  BEFORE UPDATE ON public.vendor_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Phase 2: Product Status Column
-- =============================================
ALTER TABLE public.products ADD COLUMN publish_status TEXT NOT NULL DEFAULT 'draft';

-- =============================================
-- Phase 3: Order Status History (tracking all steps)
-- =============================================
CREATE TABLE public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Users can read history for their own orders
CREATE POLICY "Users read own order history"
  ON public.order_status_history FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

-- Store owners can read history for their store's orders
CREATE POLICY "Store owners read order history"
  ON public.order_status_history FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())));

-- Staff can read all
CREATE POLICY "Staff read all order history"
  ON public.order_status_history FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- System/staff can insert
CREATE POLICY "System insert order history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (true);

-- Auto-log status changes via trigger
CREATE OR REPLACE FUNCTION public.log_order_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Also log initial order creation
CREATE OR REPLACE FUNCTION public.log_order_created()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_status_history (order_id, status, changed_by)
  VALUES (NEW.id, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_created();

-- =============================================
-- Phase 4: Self-Delivery Vendor Rates
-- =============================================
CREATE TABLE public.vendor_delivery_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  city TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  estimated_hours INTEGER DEFAULT 24,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read vendor delivery zones"
  ON public.vendor_delivery_zones FOR SELECT
  USING (true);

CREATE POLICY "Store owners manage own delivery zones"
  ON public.vendor_delivery_zones FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

CREATE POLICY "Staff manage all delivery zones"
  ON public.vendor_delivery_zones FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Enable realtime for order_status_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
