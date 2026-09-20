-- Purpose: Soft-merge payment_gateways CMS (KelPay default, PawaPay opt-in).
-- Tables: platform_settings
-- Rollback: delete key payment_gateways (harmless)
-- Risk: low — additive settings only; pawapay.enabled defaults false

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'payment_gateways',
  jsonb_build_object(
    'default_momo', 'kelpay',
    'by_country', jsonb_build_object('CD', 'kelpay'),
    'pawapay', jsonb_build_object('enabled', false)
  ),
  now()
)
ON CONFLICT (key) DO UPDATE
SET
  value = COALESCE(public.platform_settings.value, '{}'::jsonb)
    || CASE
         WHEN NOT (COALESCE(public.platform_settings.value, '{}'::jsonb) ? 'default_momo')
         THEN jsonb_build_object('default_momo', 'kelpay')
         ELSE '{}'::jsonb
       END
    || CASE
         WHEN NOT (COALESCE(public.platform_settings.value, '{}'::jsonb) ? 'by_country')
         THEN jsonb_build_object('by_country', jsonb_build_object('CD', 'kelpay'))
         ELSE '{}'::jsonb
       END
    || CASE
         WHEN NOT (COALESCE(public.platform_settings.value, '{}'::jsonb) ? 'pawapay')
         THEN jsonb_build_object('pawapay', jsonb_build_object('enabled', false))
         ELSE '{}'::jsonb
       END,
  updated_at = now();
