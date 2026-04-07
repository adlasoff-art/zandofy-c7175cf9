
-- Table to store error reports from the ErrorBoundary
CREATE TABLE public.error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_stack TEXT,
  page_path TEXT,
  browser TEXT,
  os TEXT,
  screen_width INT,
  screen_height INT,
  is_pwa BOOLEAN DEFAULT false,
  severity TEXT DEFAULT 'error',
  status TEXT DEFAULT 'new',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (even anon for unauthenticated crashes)
CREATE POLICY "Anyone can report errors"
  ON public.error_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view error reports"
  ON public.error_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update (resolve, add notes)
CREATE POLICY "Admins can update error reports"
  ON public.error_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for admin dashboard queries
CREATE INDEX idx_error_reports_created ON public.error_reports(created_at DESC);
CREATE INDEX idx_error_reports_status ON public.error_reports(status);
