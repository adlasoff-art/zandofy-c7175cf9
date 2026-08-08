-- Purpose: Category SEO long-form body + optional FAQ JSON for CollectionPage / FAQPage.
-- Tables affected: categories (ADD COLUMN only).
-- Rollback: ALTER TABLE categories DROP COLUMN IF EXISTS seo_body, DROP COLUMN IF EXISTS seo_faq;
-- Risk: additive nullable columns — safe for ~4000+ users; no data rewrite.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS seo_body text,
  ADD COLUMN IF NOT EXISTS seo_faq jsonb;

COMMENT ON COLUMN public.categories.seo_body IS 'Long-form SEO copy (300–500 words target) shown to bots/humans on category pages';
COMMENT ON COLUMN public.categories.seo_faq IS 'Optional FAQ array [{question, answer}] — real CMS only, never invented';
