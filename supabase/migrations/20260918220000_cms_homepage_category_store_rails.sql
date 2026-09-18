-- Purpose: Ensure cms_homepage_sections.config exists for category_rail / store_rail
-- Tables: cms_homepage_sections
-- Rollback: none needed (column kept); delete rail rows by section_key if desired
-- Risk: none — additive column only; existing homepage sections unchanged

ALTER TABLE public.cms_homepage_sections
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.cms_homepage_sections.config IS
  'For section_key category_rail|store_rail: { entity_id, limit?, href? }';
