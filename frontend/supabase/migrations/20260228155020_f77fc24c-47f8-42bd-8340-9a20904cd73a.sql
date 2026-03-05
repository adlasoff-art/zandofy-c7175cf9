
-- Add SEO fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text[];

-- Add SEO fields to stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text[];

-- Insert default seo_enabled = false
INSERT INTO public.platform_settings (key, value)
VALUES ('seo_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Insert default global SEO settings
INSERT INTO public.platform_settings (key, value)
VALUES ('seo_config', '{"site_title":"Zandofy","site_description":"La marketplace africaine","default_keywords":["marketplace","afrique","shopping","mode"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
