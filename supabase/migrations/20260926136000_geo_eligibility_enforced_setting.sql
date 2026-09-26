-- Purpose: Ensure geo_eligibility_enforced setting exists (idempotent duplicate of 261310 insert).
-- Tables: platform_settings
-- Risk: none

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES ('geo_eligibility_enforced', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.platform_settings IS
  'Platform JSON settings. geo_eligibility_enforced: when true, hard-filter feed/checkout by commercial scope.';
