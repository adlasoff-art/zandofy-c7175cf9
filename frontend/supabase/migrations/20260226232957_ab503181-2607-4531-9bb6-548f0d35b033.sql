
-- Customer loyalty tiers (admin-configurable)
CREATE TABLE public.customer_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL UNIQUE,
  badge_label text NOT NULL,
  min_orders integer NOT NULL,
  min_spent numeric NOT NULL,
  discount_pct numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tiers" ON public.customer_tiers FOR SELECT USING (true);
CREATE POLICY "Staff manage tiers" ON public.customer_tiers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Seed default tiers
INSERT INTO public.customer_tiers (tier_name, badge_label, min_orders, min_spent, discount_pct, sort_order) VALUES
  ('client', 'Client', 0, 0, 0, 0),
  ('junior', 'Zandofy Junior', 20, 500, 1, 1),
  ('senior', 'Zandofy Senior', 100, 2000, 3, 2),
  ('professionnel', 'Zandofy Professionnel', 250, 5000, 5, 3),
  ('business', 'Zandofy Business', 500, 10000, 10, 4),
  ('elite', 'Zandofy Elite', 1000, 50000, 12, 5),
  ('angel', 'Zandofy Angel', 1500, 100000, 15, 6);

-- Customer tier assignment (current tier per user)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_tier text NOT NULL DEFAULT 'client';

-- Badge requests
CREATE TABLE public.badge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_tier text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.badge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own badge requests" ON public.badge_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own badge requests" ON public.badge_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff read all badge requests" ON public.badge_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Staff update badge requests" ON public.badge_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Function to get customer stats (orders count + total spent excluding shipping)
CREATE OR REPLACE FUNCTION public.get_customer_loyalty_stats(p_user_id uuid)
RETURNS TABLE(total_orders bigint, total_spent numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_orders,
    COALESCE(SUM(subtotal - COALESCE(discount_amount, 0)), 0)::numeric AS total_spent
  FROM public.orders
  WHERE user_id = p_user_id
    AND status NOT IN ('cancelled', 'refunded');
$$;
