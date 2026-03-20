
-- Phase 2: Enrich profiles schema
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS residence_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS residence_city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_known_lat double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_known_lng double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_known_geo_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'fr';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_contact_channel text DEFAULT 'chat';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gdpr_consent_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_channels text[] DEFAULT '{email,push}';

-- Display ID (serial, auto-increment, visible to admins)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_id serial;

-- Phase 3: Payment methods (Mobile Money)
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL, -- mpesa, airtel, orange
  phone_number text NOT NULL,
  label text DEFAULT '',
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own payment methods" ON public.payment_methods;
CREATE POLICY "Users read own payment methods" ON public.payment_methods
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own payment methods" ON public.payment_methods;
CREATE POLICY "Users insert own payment methods" ON public.payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own payment methods" ON public.payment_methods;
CREATE POLICY "Users update own payment methods" ON public.payment_methods
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own payment methods" ON public.payment_methods;
CREATE POLICY "Users delete own payment methods" ON public.payment_methods
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all payment methods" ON public.payment_methods;
CREATE POLICY "Admins read all payment methods" ON public.payment_methods
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Phase 4: Enhance KYC verifications
ALTER TABLE public.kyc_verifications ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE public.kyc_verifications ADD COLUMN IF NOT EXISTS document_expiry date;
ALTER TABLE public.kyc_verifications ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0;

-- Phase 6: User activity logs
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all activity logs" ON public.user_activity_logs;
CREATE POLICY "Admins read all activity logs" ON public.user_activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers read all activity logs" ON public.user_activity_logs;
CREATE POLICY "Managers read all activity logs" ON public.user_activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "System can insert activity logs" ON public.user_activity_logs;
CREATE POLICY "System can insert activity logs" ON public.user_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Customer ratings (vendor rates customer)
CREATE TABLE IF NOT EXISTS public.customer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (order_id, vendor_id)
);

ALTER TABLE public.customer_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors can rate customers" ON public.customer_ratings;
CREATE POLICY "Vendors can rate customers" ON public.customer_ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Vendors read own ratings" ON public.customer_ratings;
CREATE POLICY "Vendors read own ratings" ON public.customer_ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "Admins read all customer ratings" ON public.customer_ratings;
CREATE POLICY "Admins read all customer ratings" ON public.customer_ratings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_customer_id ON public.customer_ratings(customer_id);
