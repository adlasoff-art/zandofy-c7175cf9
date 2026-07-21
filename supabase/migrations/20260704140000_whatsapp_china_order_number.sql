-- Seed WhatsApp China order number for product share template
-- Purpose: platform_settings key used by admin UI + product WhatsApp share
-- Tables: platform_settings
-- Rollback: DELETE FROM platform_settings WHERE key = 'whatsapp_china_order_number';

INSERT INTO public.platform_settings (key, value)
VALUES (
  'whatsapp_china_order_number',
  '{"phone": ""}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
