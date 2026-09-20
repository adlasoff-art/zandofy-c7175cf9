-- Purpose: Soft-merge discovery_mix + discovery_popup_delay_sec into auth_settings
-- Tables: platform_settings
-- Rollback: remove keys from value JSON (harmless if left)
-- Risk: low — additive keys only when missing; ~4000 users unaffected

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
             'rotation_hours', 12
           )
         )
         ELSE '{}'::jsonb
       END
    || CASE
         WHEN NOT (COALESCE(value, '{}'::jsonb) ? 'discovery_popup_delay_sec')
         THEN jsonb_build_object('discovery_popup_delay_sec', 15)
         ELSE '{}'::jsonb
       END,
  updated_at = now()
WHERE key = 'auth_settings';
