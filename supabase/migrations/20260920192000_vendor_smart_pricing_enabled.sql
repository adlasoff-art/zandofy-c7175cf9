-- Purpose: Admin can enable smart pricing per independent store; platform stores default on.
-- Tables: public.vendor_pricing_overrides
-- Risk: Additive column + backfill for platform-owned stores only.
-- Rollback: ALTER TABLE vendor_pricing_overrides DROP COLUMN smart_pricing_enabled;
-- Staging → production: run after smoke independent vendor product form.

ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS smart_pricing_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_pricing_overrides.smart_pricing_enabled IS
  'When true, independent vendors may use auto pricing calculator. Platform-owned stores backfilled true.';

UPDATE public.vendor_pricing_overrides vpo
SET smart_pricing_enabled = true
FROM public.stores s
WHERE s.id = vpo.store_id
  AND s.is_platform_owned IS TRUE
  AND vpo.smart_pricing_enabled IS DISTINCT FROM true;

-- Ensure platform-owned stores have an overrides row with smart pricing on
INSERT INTO public.vendor_pricing_overrides (store_id, smart_pricing_enabled)
SELECT s.id, true
FROM public.stores s
WHERE s.is_platform_owned IS TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_pricing_overrides v WHERE v.store_id = s.id
  )
ON CONFLICT (store_id) DO UPDATE
SET smart_pricing_enabled = EXCLUDED.smart_pricing_enabled
WHERE public.vendor_pricing_overrides.smart_pricing_enabled IS DISTINCT FROM true;
