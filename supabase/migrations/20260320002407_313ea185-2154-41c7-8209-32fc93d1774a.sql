
-- Change default commission_pct on referrals table from 5 to 3
ALTER TABLE public.referrals ALTER COLUMN commission_pct SET DEFAULT 3;
