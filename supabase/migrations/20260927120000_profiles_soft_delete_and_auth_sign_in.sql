-- Purpose: Soft-delete profiles + denormalized auth last sign-in for admin filters.
-- Tables: profiles
-- Risk: additive nullable columns; list UI hides deleted by default
-- Staging → prod: apply then deploy admin-users Edge + frontend
-- Note: soft-delete also bans Auth session via Edge. No public RLS hide of deleted_at
--       rows yet — admin list filters client-side; ban blocks login.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auth_last_sign_in_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_auth_last_sign_in_at
  ON public.profiles (auth_last_sign_in_at)
  WHERE auth_last_sign_in_at IS NULL;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Soft-delete timestamp. Hard delete via Edge admin-users delete_user frees auth email.';
COMMENT ON COLUMN public.profiles.auth_last_sign_in_at IS
  'Synced from auth.users.last_sign_in_at for admin filters (never logged in).';
