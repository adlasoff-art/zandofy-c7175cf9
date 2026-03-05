
-- Add subtitle and cta columns to cms_banners for hero slides
ALTER TABLE public.cms_banners ADD COLUMN IF NOT EXISTS subtitle text DEFAULT '';
ALTER TABLE public.cms_banners ADD COLUMN IF NOT EXISTS cta text DEFAULT '';

-- Update existing hero slides with subtitle/cta
UPDATE public.cms_banners SET subtitle = 'Électronique, mode, maison — tout à prix réduit', cta = 'ACHETER MAINTENANT' WHERE title = 'MÉGA SOLDES 2026' AND position = 'hero_slide';
UPDATE public.cms_banners SET subtitle = 'Maison & Déco, meubles, luminaires', cta = 'VOIR LES OFFRES' WHERE title LIKE 'JUSQU%' AND position = 'hero_slide';
UPDATE public.cms_banners SET subtitle = 'Smartphones, tablettes, accessoires tech', cta = 'DÉCOUVRIR' WHERE title = 'NOUVEAUX GADGETS' AND position = 'hero_slide';

-- Add newness_duration_days platform setting
INSERT INTO public.platform_settings (key, value) VALUES ('newness_duration_days', '14'::jsonb)
ON CONFLICT (key) DO NOTHING;
