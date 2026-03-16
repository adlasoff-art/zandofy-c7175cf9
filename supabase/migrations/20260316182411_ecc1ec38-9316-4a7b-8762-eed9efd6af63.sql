
-- Add new columns to cms_menu_items for dynamic navigation
ALTER TABLE public.cms_menu_items ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.cms_menu_items(id) ON DELETE SET NULL;
ALTER TABLE public.cms_menu_items ADD COLUMN IF NOT EXISTS highlight boolean NOT NULL DEFAULT false;
ALTER TABLE public.cms_menu_items ADD COLUMN IF NOT EXISTS has_mega boolean NOT NULL DEFAULT false;
ALTER TABLE public.cms_menu_items ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.cms_menu_items ADD COLUMN IF NOT EXISTS open_in_new_tab boolean NOT NULL DEFAULT false;

-- Seed category_nav items matching current hardcoded NAV_LINK_KEYS
INSERT INTO public.cms_menu_items (label, url, menu_group, sort_order, is_visible, has_mega, highlight) VALUES
  ('Catégories', '#', 'category_nav', 0, true, true, false),
  ('Nouveautés', '/category/nouveautes', 'category_nav', 1, true, false, false),
  ('Soldes', '/category/soldes', 'category_nav', 2, true, false, true),
  ('Électronique', '/category/electronics', 'category_nav', 3, true, false, false),
  ('Maillots de bain', '/search?q=maillots+de+bain', 'category_nav', 4, true, false, false),
  ('Maison & Déco', '/category/home', 'category_nav', 5, true, false, false),
  ('Vêtements Femme', '/category/women', 'category_nav', 6, true, false, false),
  ('Vêtements Homme', '/category/men', 'category_nav', 7, true, false, false),
  ('Chaussures', '/category/shoes', 'category_nav', 8, true, false, false),
  ('Bijoux & Accessoires', '/category/accessories', 'category_nav', 9, true, false, false),
  ('Beauté & Santé', '/search?q=beauté+santé', 'category_nav', 10, true, false, false),
  ('Sacs & Bagages', '/category/bags', 'category_nav', 11, true, false, false),
  ('Sports & Plein air', '/search?q=sports', 'category_nav', 12, true, false, false),
  ('Enfants', '/category/kids', 'category_nav', 13, true, false, false);
