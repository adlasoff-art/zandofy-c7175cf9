
-- Add referral_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate referral codes for existing profiles
UPDATE public.profiles 
SET referral_code = 'ZANDO-' || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- Make referral_code NOT NULL with default
ALTER TABLE public.profiles ALTER COLUMN referral_code SET DEFAULT '';

-- Referrals table: links referrer to referee
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referee_id UUID NOT NULL UNIQUE,
  rewarded_orders_count INTEGER NOT NULL DEFAULT 0,
  max_rewarded_orders INTEGER NOT NULL DEFAULT 5,
  commission_pct NUMERIC NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own referrals as referrer"
ON public.referrals FOR SELECT
USING (referrer_id = auth.uid());

CREATE POLICY "Users read own referrals as referee"
ON public.referrals FOR SELECT
USING (referee_id = auth.uid());

CREATE POLICY "System insert referrals"
ON public.referrals FOR INSERT
WITH CHECK (referee_id = auth.uid());

CREATE POLICY "Staff read all referrals"
ON public.referrals FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff update referrals"
ON public.referrals FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ZandoPoints wallet
CREATE TABLE public.zando_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  pending_balance NUMERIC NOT NULL DEFAULT 0,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zando_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own points"
ON public.zando_points FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users update own points"
ON public.zando_points FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users insert own points"
ON public.zando_points FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff read all points"
ON public.zando_points FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff update all points"
ON public.zando_points FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Point transactions ledger
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL, -- 'earned', 'spent', 'voided', 'pending'
  description TEXT,
  order_id UUID,
  referral_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own transactions"
ON public.point_transactions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users insert own transactions"
ON public.point_transactions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff read all transactions"
ON public.point_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff insert transactions"
ON public.point_transactions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed referral settings in platform_settings
INSERT INTO public.platform_settings (key, value) VALUES
('referral_settings', '{"commission_pct": 5, "max_rewarded_orders": 5, "welcome_discount_pct": 10, "enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
