
-- Add RLS policies for user_activity_logs (table already exists)
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own activity
DROP POLICY IF EXISTS "Users can insert own activity" ON public.user_activity_logs;
CREATE POLICY "Users can insert own activity"
ON public.user_activity_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can read their own activity
DROP POLICY IF EXISTS "Users can read own activity" ON public.user_activity_logs;
CREATE POLICY "Users can read own activity"
ON public.user_activity_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Admin/manager can delete old logs
DROP POLICY IF EXISTS "Admin can delete activity logs" ON public.user_activity_logs;
CREATE POLICY "Admin can delete activity logs"
ON public.user_activity_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON public.user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at DESC);

-- Cleanup function for automatic retention
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete logs older than 6 months
  DELETE FROM public.user_activity_logs
  WHERE created_at < (now() - interval '6 months');
END;
$$;
