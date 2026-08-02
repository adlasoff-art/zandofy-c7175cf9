-- Purpose: Add per-category SEO fields (Rank Math-style CMS) for marketplace SERP control.
-- Tables: public.categories
-- Rollback: ALTER TABLE public.categories DROP COLUMN IF EXISTS meta_title, meta_description, seo_keywords, og_image_url;
-- Risk: Additive nullable columns only — safe for ~4000+ users; no data rewrite.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text[],
  ADD COLUMN IF NOT EXISTS og_image_url text;

COMMENT ON COLUMN public.categories.meta_title IS 'SEO title override (≤60 chars). Falls back to seo_config.category_title_template.';
COMMENT ON COLUMN public.categories.meta_description IS 'SEO meta description override (≤160 chars).';
COMMENT ON COLUMN public.categories.seo_keywords IS 'Optional SEO keywords array.';
COMMENT ON COLUMN public.categories.og_image_url IS 'Optional Open Graph image URL for category pages.';
