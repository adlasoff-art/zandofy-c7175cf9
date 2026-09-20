-- Purpose: Category flag to show apparel-specific fields (model_size) in vendor form.
-- Tables: public.categories
-- Risk: Additive column default false — no data loss.
-- Rollback: ALTER TABLE categories DROP COLUMN apparel_fields_enabled;
-- Staging → production: admin can toggle; optional seed for clothing categories by name.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS apparel_fields_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.categories.apparel_fields_enabled IS
  'When true, vendor product form shows model_size (mannequin) and apparel-oriented hints.';

-- Best-effort seed for common clothing category names (FR/EN), idempotent
UPDATE public.categories
SET apparel_fields_enabled = true
WHERE apparel_fields_enabled IS DISTINCT FROM true
  AND (
    lower(coalesce(name_fr, '')) ~ '(vêt|vetement|mode|habit|chaussure|textile|lingerie|accessoire)'
    OR lower(coalesce(name, '')) ~ '(cloth|apparel|fashion|shoe|wear|textile)'
  );
