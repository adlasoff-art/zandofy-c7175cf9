
-- ═══════════════════════════════════════════════════
-- LOT C: Rate Limiting Table
-- ═══════════════════════════════════════════════════

CREATE TABLE public.rate_limit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_lookup ON public.rate_limit_entries (identifier, endpoint, window_start);

ALTER TABLE public.rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- Only admins can read rate limit entries (for monitoring)
CREATE POLICY "Admins read rate limits"
ON public.rate_limit_entries FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Function to check and increment rate limit (used by edge functions)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_requests INT,
  p_window_seconds INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;
  
  -- Clean old entries
  DELETE FROM public.rate_limit_entries
  WHERE identifier = p_identifier AND endpoint = p_endpoint AND window_start < v_window_start;
  
  -- Count recent requests
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.rate_limit_entries
  WHERE identifier = p_identifier AND endpoint = p_endpoint AND window_start >= v_window_start;
  
  IF v_count >= p_max_requests THEN
    RETURN FALSE; -- Rate limited
  END IF;
  
  -- Record this request
  INSERT INTO public.rate_limit_entries (identifier, endpoint, request_count, window_start)
  VALUES (p_identifier, p_endpoint, 1, now());
  
  RETURN TRUE; -- Allowed
END;
$$;

-- Cleanup function for old rate limit entries (call periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_entries WHERE window_start < now() - interval '1 hour';
END;
$$;

-- ═══════════════════════════════════════════════════
-- LOT D: Audit Fixes
-- ═══════════════════════════════════════════════════

-- Fix 1: store_payment_numbers — restrict public read to authenticated only
DROP POLICY IF EXISTS "Public read active payment numbers" ON public.store_payment_numbers;
CREATE POLICY "Authenticated read active payment numbers"
ON public.store_payment_numbers FOR SELECT TO authenticated
USING (is_active = true);

-- Fix 2: reviews — only show approved reviews publicly
DROP POLICY IF EXISTS "Public read reviews" ON public.reviews;
CREATE POLICY "Public read approved reviews"
ON public.reviews FOR SELECT
USING (is_approved = true);

-- Users can always see their own reviews (even unapproved)
CREATE POLICY "Users read own reviews"
ON public.reviews FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: cms_popups — only show active popups
DROP POLICY IF EXISTS "Anyone can view active popups" ON public.cms_popups;
CREATE POLICY "Public read active popups"
ON public.cms_popups FOR SELECT
USING (is_active = true);

-- Admins can see all popups
CREATE POLICY "Admins read all popups"
ON public.cms_popups FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ═══════════════════════════════════════════════════
-- LOT A: Geo-blocking seed data
-- ═══════════════════════════════════════════════════

INSERT INTO public.platform_settings (key, value)
VALUES ('geo_blocked_countries', '{"blocked": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;
