INSERT INTO public.platform_settings (key, value)
VALUES (
  'watermark_config',
  jsonb_build_object(
    'enabled', false,
    'logo_url', '',
    'position', 'bottom-right',
    'opacity', 0.5,
    'size_ratio', 0.12,
    'margin_ratio', 0.02
  )
)
ON CONFLICT (key) DO NOTHING;