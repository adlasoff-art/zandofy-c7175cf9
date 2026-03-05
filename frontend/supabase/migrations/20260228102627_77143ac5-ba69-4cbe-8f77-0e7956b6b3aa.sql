
-- ═══ CMS BANNERS ═══
CREATE TABLE public.cms_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  position text NOT NULL DEFAULT 'hero',
  link text DEFAULT '/',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active banners" ON public.cms_banners
  FOR SELECT USING (is_active = true);

CREATE POLICY "Staff manage banners" ON public.cms_banners
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ═══ CMS MENU ITEMS ═══
CREATE TABLE public.cms_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL DEFAULT '/',
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  menu_group text NOT NULL DEFAULT 'main',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read visible menus" ON public.cms_menu_items
  FOR SELECT USING (is_visible = true);

CREATE POLICY "Staff manage menus" ON public.cms_menu_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ═══ CMS PAGES (static content) ═══
CREATE TABLE public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published pages" ON public.cms_pages
  FOR SELECT USING (is_published = true);

CREATE POLICY "Staff manage pages" ON public.cms_pages
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ═══ CMS HOMEPAGE SECTIONS ═══
CREATE TABLE public.cms_homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text UNIQUE NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_homepage_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active sections" ON public.cms_homepage_sections
  FOR SELECT USING (is_active = true);

CREATE POLICY "Staff manage sections" ON public.cms_homepage_sections
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Seed default homepage sections
INSERT INTO public.cms_homepage_sections (section_key, label, sort_order) VALUES
  ('hero_banner', 'Bannière Hero', 1),
  ('categories', 'Catégories', 2),
  ('flash_sales', 'Ventes Flash', 3),
  ('top_trends', 'Tendances', 4),
  ('product_grid', 'Grille Produits', 5);

-- Trigger for updated_at
CREATE TRIGGER update_cms_banners_updated_at BEFORE UPDATE ON public.cms_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cms_menu_items_updated_at BEFORE UPDATE ON public.cms_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cms_pages_updated_at BEFORE UPDATE ON public.cms_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cms_sections_updated_at BEFORE UPDATE ON public.cms_homepage_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add banners to storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('cms-assets', 'cms-assets', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public read cms assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'cms-assets');

CREATE POLICY "Staff upload cms assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cms-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Staff update cms assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'cms-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Staff delete cms assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'cms-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
