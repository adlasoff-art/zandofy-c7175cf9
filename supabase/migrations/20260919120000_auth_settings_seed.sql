-- Purpose: Seed platform_settings.auth_settings for fluid/strict signup + onboarding toggles
-- Tables: platform_settings
-- Rollback: DELETE FROM platform_settings WHERE key = 'auth_settings';
-- Risk: low — defaults match product intent (fluid); toggle to strict if abuse

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'auth_settings',
  jsonb_build_object(
    'mode', 'fluid',
    'collect_phone_on_signup', true,
    'address_onboarding_enabled', true,
    'gate_checkout_on_email_confirm', false
  ),
  now()
)
ON CONFLICT (key) DO NOTHING;
