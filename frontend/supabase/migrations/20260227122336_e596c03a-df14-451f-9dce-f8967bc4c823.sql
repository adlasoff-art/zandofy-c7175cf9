
-- Platform settings table for admin-configurable parameters
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Public can read settings
CREATE POLICY "Public read platform settings"
ON public.platform_settings
FOR SELECT
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins manage platform settings"
ON public.platform_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed the free shipping threshold setting
INSERT INTO public.platform_settings (key, value) VALUES
('free_shipping_threshold', '{"enabled": true, "amount": 49, "currency": "USD"}'::jsonb);
