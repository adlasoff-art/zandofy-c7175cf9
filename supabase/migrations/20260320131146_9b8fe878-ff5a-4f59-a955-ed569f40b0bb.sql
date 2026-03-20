
-- Add second image URL to featured_placements for dual-image slider
ALTER TABLE public.featured_placements ADD COLUMN IF NOT EXISTS image_url_2 text DEFAULT NULL;

COMMENT ON COLUMN public.featured_placements.image_url_2 IS 'Optional second image for auto-sliding between 2 visuals per placement';
