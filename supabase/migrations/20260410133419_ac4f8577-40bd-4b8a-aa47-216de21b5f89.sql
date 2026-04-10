-- B1: Drop residual plaintext token column
ALTER TABLE public.impersonation_tokens DROP COLUMN IF EXISTS token;

-- B2: Fix error_reports — restrict INSERT to authenticated users
DROP POLICY IF EXISTS "Anyone can insert error reports" ON public.error_reports;
CREATE POLICY "Authenticated users can insert error reports"
  ON public.error_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- B3: Rate limit entries — secure write access via SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.upsert_rate_limit(
  p_key TEXT,
  p_window_seconds INT DEFAULT 60,
  p_max_requests INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Clean expired entries
  DELETE FROM rate_limit_entries WHERE window_start < now() - interval '1 hour';
  
  -- Check current count
  SELECT count INTO v_count
  FROM rate_limit_entries
  WHERE key = p_key
    AND window_start > now() - (p_window_seconds || ' seconds')::interval;
  
  IF v_count IS NOT NULL AND v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Upsert the entry
  INSERT INTO rate_limit_entries (key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE
  SET count = rate_limit_entries.count + 1,
      window_start = CASE
        WHEN rate_limit_entries.window_start < now() - (p_window_seconds || ' seconds')::interval
        THEN now()
        ELSE rate_limit_entries.window_start
      END;
  
  RETURN TRUE;
END;
$$;