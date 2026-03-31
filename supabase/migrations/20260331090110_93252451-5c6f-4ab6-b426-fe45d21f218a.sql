
-- ============================================================
-- Phase 1 Migration: provinces, store_transfer_requests,
-- analytics_sessions, page_views + cities.province_id
-- ============================================================

-- 1. Provinces table
CREATE TABLE IF NOT EXISTS public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text NOT NULL DEFAULT 'CD',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read provinces" ON public.provinces;
CREATE POLICY "Anyone can read provinces" ON public.provinces
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage provinces" ON public.provinces;
CREATE POLICY "Admins manage provinces" ON public.provinces
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 2. Add province_id to cities
DO $$ BEGIN
  ALTER TABLE public.cities ADD COLUMN province_id uuid REFERENCES public.provinces(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_cities_province_id ON public.cities(province_id);

-- 3. Store transfer requests
CREATE TABLE IF NOT EXISTS public.store_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  kyc_verified_from boolean DEFAULT false,
  kyc_verified_to boolean DEFAULT false,
  cooldown_until timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.store_transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage store transfers" ON public.store_transfer_requests;
CREATE POLICY "Admins manage store transfers" ON public.store_transfer_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Owners read own transfers" ON public.store_transfer_requests;
CREATE POLICY "Owners read own transfers" ON public.store_transfer_requests
  FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Validation trigger for status + cooldown
CREATE OR REPLACE FUNCTION public.validate_store_transfer()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','under_review','completed','rejected','cancelled') THEN
    RAISE EXCEPTION 'Invalid transfer status: %', NEW.status;
  END IF;
  IF NEW.status = 'completed' AND OLD.status = 'under_review' THEN
    NEW.cooldown_until := now() + interval '72 hours';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_store_transfer ON public.store_transfer_requests;
CREATE TRIGGER trg_validate_store_transfer
  BEFORE UPDATE ON public.store_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_store_transfer();

-- 4. Analytics sessions
CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  pages_visited text[],
  entry_page text,
  exit_page text,
  device_type text,
  country_code text,
  city text
);

ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read analytics sessions" ON public.analytics_sessions;
CREATE POLICY "Admins read analytics sessions" ON public.analytics_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Anyone insert analytics sessions" ON public.analytics_sessions;
CREATE POLICY "Anyone insert analytics sessions" ON public.analytics_sessions
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON public.analytics_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user ON public.analytics_sessions(user_id);

-- 5. Page views
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid,
  page_path text NOT NULL,
  store_id uuid,
  product_id uuid,
  viewed_at timestamptz DEFAULT now(),
  time_on_page_seconds integer
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read page views" ON public.page_views;
CREATE POLICY "Admins read page views" ON public.page_views
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Anyone insert page views" ON public.page_views;
CREATE POLICY "Anyone insert page views" ON public.page_views
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_page_views_session ON public.page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed ON public.page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON public.page_views(page_path);
