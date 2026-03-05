
-- Coupons table
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_amount numeric DEFAULT 0,
  max_uses integer DEFAULT NULL,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active coupons" ON public.coupons
  FOR SELECT USING (is_active = true);

-- Saved addresses table
CREATE TABLE public.saved_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Domicile',
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  country text NOT NULL DEFAULT 'Sénégal',
  postal_code text DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own addresses" ON public.saved_addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own addresses" ON public.saved_addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own addresses" ON public.saved_addresses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own addresses" ON public.saved_addresses
  FOR DELETE USING (auth.uid() = user_id);

-- Add coupon_code to orders
ALTER TABLE public.orders ADD COLUMN coupon_code text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN discount_amount numeric DEFAULT 0;

-- Insert some test coupons
INSERT INTO public.coupons (code, discount_type, discount_value, min_order_amount) VALUES
  ('BIENVENUE10', 'percentage', 10, 20),
  ('PROMO5', 'fixed', 5, 15),
  ('VIP20', 'percentage', 20, 50);
