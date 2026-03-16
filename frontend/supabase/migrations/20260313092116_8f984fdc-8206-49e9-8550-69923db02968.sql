
-- Add display_mode to categories (icon or image)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'icon';

-- Add target_page to cms_banners for positionable banners
ALTER TABLE public.cms_banners ADD COLUMN IF NOT EXISTS target_page text NOT NULL DEFAULT 'home';

-- Add bg_color and text_color to cms_banners for color customization
ALTER TABLE public.cms_banners ADD COLUMN IF NOT EXISTS bg_color text;
ALTER TABLE public.cms_banners ADD COLUMN IF NOT EXISTS text_color text;
