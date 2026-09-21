-- Purpose: Soft auth conversion — email_is_placeholder on profiles + magic_link_enabled in auth_settings
-- Tables: profiles, platform_settings
-- Rollback: DROP COLUMN email_is_placeholder; remove magic_link_enabled from JSON
-- Risk: low — additive nullable/default false; ~4000 users unaffected

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_is_placeholder boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.email_is_placeholder IS
  'True when auth email is synthetic (@users.zandofy.internal) from phone-only signup';

-- Soft-merge magic_link_enabled = false when missing
UPDATE public.platform_settings
SET
  value = COALESCE(value, '{}'::jsonb)
    || CASE
         WHEN NOT (COALESCE(value, '{}'::jsonb) ? 'magic_link_enabled')
         THEN jsonb_build_object('magic_link_enabled', false)
         ELSE '{}'::jsonb
       END,
  updated_at = now()
WHERE key = 'auth_settings';

-- Index for phone login resolve (exact E.164 match)
CREATE INDEX IF NOT EXISTS idx_profiles_phone_e164
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';
