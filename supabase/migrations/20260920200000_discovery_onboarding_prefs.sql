-- Purpose: Discovery onboarding prefs on profiles + auth_settings kill-switch
-- Tables: profiles (ADD COLUMN), platform_settings (auth_settings key merge)
-- Rollback: ALTER TABLE profiles DROP COLUMN IF EXISTS discovery_prefs;
--           (auth_settings key can remain — harmless)
-- Risk: low — nullable JSONB only; ~4000 users unaffected until they complete onboarding

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_prefs jsonb;

COMMENT ON COLUMN public.profiles.discovery_prefs IS
  'Guest/user discovery onboarding: audience, interests, purchase_scope, receipt, payment, country';

-- Soft-merge discovery keys only when missing (idempotent; do not reset admin kill-switch)
UPDATE public.platform_settings
SET
  value = COALESCE(value, '{}'::jsonb)
    || CASE
         WHEN NOT (COALESCE(value, '{}'::jsonb) ? 'discovery_onboarding_enabled')
         THEN jsonb_build_object('discovery_onboarding_enabled', true)
         ELSE '{}'::jsonb
       END
    || CASE
         WHEN NOT (COALESCE(value, '{}'::jsonb) ? 'discovery_onboarding_steps')
         THEN jsonb_build_object(
           'discovery_onboarding_steps',
           jsonb_build_object('payment', true, 'receipt', true)
         )
         ELSE '{}'::jsonb
       END,
  updated_at = now()
WHERE key = 'auth_settings';

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'auth_settings',
  jsonb_build_object(
    'mode', 'fluid',
    'collect_phone_on_signup', true,
    'address_onboarding_enabled', true,
    'gate_checkout_on_email_confirm', false,
    'discovery_onboarding_enabled', true,
    'discovery_onboarding_steps', jsonb_build_object('payment', true, 'receipt', true)
  ),
  now()
)
ON CONFLICT (key) DO NOTHING;
