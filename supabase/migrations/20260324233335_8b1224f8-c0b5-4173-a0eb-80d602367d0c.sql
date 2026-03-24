
-- ============================================================
-- MIGRATION: delivery_chats, rider_ratings, tip_amount, delivery_zones, premium_subscriptions, vendor_boosts, geo_coupons
-- ============================================================

-- 1. delivery_chats — ephemeral chat during delivery
CREATE TABLE IF NOT EXISTS public.delivery_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat participants can read" ON public.delivery_chats;
CREATE POLICY "Chat participants can read" ON public.delivery_chats
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = delivery_chats.order_id AND o.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = delivery_chats.order_id AND o.assigned_rider_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.deliveries d WHERE d.id = delivery_chats.delivery_id AND d.rider_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Chat participants can insert" ON public.delivery_chats;
CREATE POLICY "Chat participants can insert" ON public.delivery_chats
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.orders o WHERE o.id = delivery_chats.order_id AND (o.user_id = auth.uid() OR o.assigned_rider_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_chats.delivery_id AND d.rider_id = auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_chats;

-- 2. rider_ratings
CREATE TABLE IF NOT EXISTS public.rider_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  rider_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, user_id)
);

ALTER TABLE public.rider_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rider ratings" ON public.rider_ratings;
CREATE POLICY "Anyone can read rider ratings" ON public.rider_ratings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users create ratings" ON public.rider_ratings;
CREATE POLICY "Authenticated users create ratings" ON public.rider_ratings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Validation trigger for rating 1-5
CREATE OR REPLACE FUNCTION public.validate_rider_rating()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_validate_rider_rating BEFORE INSERT OR UPDATE ON public.rider_ratings
    FOR EACH ROW EXECUTE FUNCTION public.validate_rider_rating();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. tip_amount on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0;

-- 4. delivery_zones
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL,
  country text NOT NULL DEFAULT 'RDC',
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by_admin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active delivery zones" ON public.delivery_zones;
CREATE POLICY "Public read active delivery zones" ON public.delivery_zones
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage delivery zones" ON public.delivery_zones;
CREATE POLICY "Admins manage delivery zones" ON public.delivery_zones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. premium_subscriptions
CREATE TABLE IF NOT EXISTS public.premium_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_name text NOT NULL DEFAULT 'Zandofy Premium',
  price numeric NOT NULL DEFAULT 9.99,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own subscriptions" ON public.premium_subscriptions;
CREATE POLICY "Users read own subscriptions" ON public.premium_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users create subscriptions" ON public.premium_subscriptions;
CREATE POLICY "Users create subscriptions" ON public.premium_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.premium_subscriptions;
CREATE POLICY "Admins manage subscriptions" ON public.premium_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. vendor_boosts
CREATE TABLE IF NOT EXISTS public.vendor_boosts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active boosts" ON public.vendor_boosts;
CREATE POLICY "Public read active boosts" ON public.vendor_boosts
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Vendor manage own boosts" ON public.vendor_boosts;
CREATE POLICY "Vendor manage own boosts" ON public.vendor_boosts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = vendor_boosts.store_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage boosts" ON public.vendor_boosts;
CREATE POLICY "Admins manage boosts" ON public.vendor_boosts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. geo-targeted coupons
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS target_city text;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS target_country text;
