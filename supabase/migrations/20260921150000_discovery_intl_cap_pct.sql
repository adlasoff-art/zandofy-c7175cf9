-- Purpose: Soft-merge intl_cap_pct into auth_settings.discovery_mix (local-first explore cap)
-- Tables: platform_settings
-- Rollback: remove intl_cap_pct from discovery_mix JSON (frontend defaults to 10)
-- Risk: low — additive key only when missing; ~4000 users unaffected
--
-- Note: if discovery_mix is entirely absent, also seed the full default mix object
-- so jsonb_set does not leave a partial {intl_cap_pct}-only mix.

UPDATE public.platform_settings
SET
  value = COALESCE(value, '{}'::jsonb)
    || CASE
         WHEN NOT (COALESCE(value, '{}'::jsonb) ? 'discovery_mix')
         THEN jsonb_build_object(
           'discovery_mix',
           jsonb_build_object(
             'core_pct', 65,
             'explore_pct', 25,
             'neutral_pct', 10,
             'city_pct', 45,
             'country_within_core_pct', 20,
             'rotation_hours', 12,
             'intl_cap_pct', 10
           )
         )
         ELSE '{}'::jsonb
       END,
  updated_at = now()
WHERE key = 'auth_settings'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'discovery_mix');

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
  AND (COALESCE(value, '{}'::jsonb) ? 'discovery_mix')
  AND NOT (COALESCE(value->'discovery_mix', '{}'::jsonb) ? 'intl_cap_pct');
