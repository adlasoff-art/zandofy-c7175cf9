
-- ============================================================
-- PHASE 2 — Tables pour fonctionnalités e-commerce avancées
-- ============================================================

-- 2.1 Return Requests
CREATE TABLE public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  user_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id),
  reason text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  refund_amount numeric NOT NULL DEFAULT 0,
  refund_method text DEFAULT 'original',
  admin_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own returns" ON public.return_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users create own returns" ON public.return_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Store owners read returns" ON public.return_requests FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Store owners update returns" ON public.return_requests FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Staff manage returns" ON public.return_requests FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_return_requests_updated_at BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.2 Disputes
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  return_request_id uuid REFERENCES public.return_requests(id),
  user_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id),
  reason text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own disputes" ON public.disputes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users create own disputes" ON public.disputes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Store owners read disputes" ON public.disputes FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Staff manage disputes" ON public.disputes FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dispute messages for conversation
CREATE TABLE public.dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispute participants read messages" ON public.dispute_messages FOR SELECT
  USING (
    dispute_id IN (SELECT id FROM disputes WHERE user_id = auth.uid())
    OR dispute_id IN (SELECT id FROM disputes WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
    OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
  );
CREATE POLICY "Dispute participants insert messages" ON public.dispute_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND (
      dispute_id IN (SELECT id FROM disputes WHERE user_id = auth.uid())
      OR dispute_id IN (SELECT id FROM disputes WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
      OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')
    )
  );

-- 2.5 Vendor/Store Reviews
CREATE TABLE public.store_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  rating integer NOT NULL,
  comment text DEFAULT '',
  is_verified_purchase boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read store reviews" ON public.store_reviews FOR SELECT USING (true);
CREATE POLICY "Users insert own store reviews" ON public.store_reviews FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own store reviews" ON public.store_reviews FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own store reviews" ON public.store_reviews FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Staff manage store reviews" ON public.store_reviews FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Validate rating 1-5
CREATE OR REPLACE FUNCTION public.validate_store_review_rating()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_store_review_rating BEFORE INSERT OR UPDATE ON public.store_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_store_review_rating();

-- 2.4 Exchange Rates
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL DEFAULT 'USD',
  target_currency text NOT NULL,
  rate numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read exchange rates" ON public.exchange_rates FOR SELECT USING (true);
CREATE POLICY "Staff manage exchange rates" ON public.exchange_rates FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Seed default rates
INSERT INTO public.exchange_rates (base_currency, target_currency, rate) VALUES
  ('USD', 'EUR', 0.92),
  ('USD', 'XAF', 605),
  ('USD', 'CDF', 2800),
  ('USD', 'NGN', 1550),
  ('USD', 'GBP', 0.79),
  ('USD', 'CNY', 7.24);

-- 2.6 Affiliate tiers
CREATE TABLE public.affiliate_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL,
  min_referrals integer NOT NULL DEFAULT 0,
  commission_pct numeric NOT NULL DEFAULT 5,
  bonus_points integer NOT NULL DEFAULT 0,
  badge_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read affiliate tiers" ON public.affiliate_tiers FOR SELECT USING (true);
CREATE POLICY "Staff manage affiliate tiers" ON public.affiliate_tiers FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed default affiliate tiers
INSERT INTO public.affiliate_tiers (tier_name, min_referrals, commission_pct, bonus_points, badge_label) VALUES
  ('Bronze', 0, 5, 0, '🥉 Bronze'),
  ('Argent', 5, 7, 100, '🥈 Argent'),
  ('Or', 15, 10, 500, '🥇 Or'),
  ('Platine', 50, 15, 2000, '💎 Platine');

-- Add affiliate_tier to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS affiliate_tier text DEFAULT 'Bronze';
