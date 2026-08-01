-- Seed kill-switch for home delivery (last-mile)
-- Purpose: platform_settings flag used by admin + checkout/dashboard/tracking
-- Tables: platform_settings
-- Rollback: DELETE FROM platform_settings WHERE key = 'home_delivery_enabled';

INSERT INTO public.platform_settings (key, value)
VALUES (
  'home_delivery_enabled',
  '{"enabled": false}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
