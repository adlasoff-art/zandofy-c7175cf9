-- Purpose: Soft-merge intl_cap_pct into auth_settings.discovery_mix (local-first explore cap)
-- Tables: platform_settings
-- Rollback: remove intl_cap_pct from discovery_mix JSON (frontend defaults to 10)
-- Risk: low — additive key only when missing; ~4000 users unaffected

UPDATE public.platform_settings
SET
  value = jsonb_set(
    COALESCE(value, '{}'::jsonb),
    '{discovery_mix,intl_cap_pct}',
    '10'::jsonb,
    true
  ),
  updated_at = now()
WHERE key = 'auth_settings'
  AND (
    NOT (COALESCE(value, '{}'::jsonb) ? 'discovery_mix')
    OR NOT (COALESCE(value->'discovery_mix', '{}'::jsonb) ? 'intl_cap_pct')
  );
