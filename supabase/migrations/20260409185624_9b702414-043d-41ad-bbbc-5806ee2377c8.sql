CREATE TABLE public.pwa_installs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  session_id TEXT NOT NULL,
  os TEXT,
  browser TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pwa_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pwa installs"
ON public.pwa_installs FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert pwa installs"
ON public.pwa_installs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can delete pwa installs"
ON public.pwa_installs FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));