
-- Analytics events table for tracking user behavior
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- page_view, product_click, store_view, pwa_install, session_start, session_end
  page_path TEXT,
  referrer TEXT,
  product_id UUID,
  store_id UUID,
  device_type TEXT, -- mobile, tablet, desktop
  os TEXT, -- ios, android, windows, macos, linux
  browser TEXT,
  is_pwa BOOLEAN DEFAULT false,
  screen_width INT,
  screen_height INT,
  duration_seconds INT,
  metadata JSONB DEFAULT '{}',
  country TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_product ON public.analytics_events(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_analytics_events_store ON public.analytics_events(store_id) WHERE store_id IS NOT NULL;
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id) WHERE user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert analytics events (including anonymous users)
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read analytics events
CREATE POLICY "Admins can read analytics events"
ON public.analytics_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Seed payment_methods settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('payment_methods', '{"mobile_money": true, "stripe": true, "cod": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
