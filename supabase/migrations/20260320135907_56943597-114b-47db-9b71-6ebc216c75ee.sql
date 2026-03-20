
CREATE TABLE IF NOT EXISTS public.trend_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_fr text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trend_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active trend tags" ON public.trend_tags;
CREATE POLICY "Anyone can read active trend tags"
  ON public.trend_tags FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage trend tags" ON public.trend_tags;
CREATE POLICY "Admins can manage trend tags"
  ON public.trend_tags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN trend_tag_id uuid REFERENCES public.trend_tags(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_trend_tag_id ON public.products(trend_tag_id);

INSERT INTO public.trend_tags (name, name_fr, slug, sort_order) VALUES
  ('Tops', 'Hauts', 'tops', 1),
  ('Bottoms', 'Bas', 'bottoms', 2),
  ('Dresses', 'Robes', 'dresses', 3),
  ('Outerwear', 'Extérieur', 'outerwear', 4),
  ('Sets', 'Ensembles', 'sets', 5),
  ('Shoes', 'Chaussures', 'shoes', 6),
  ('Accessories', 'Accessoires', 'accessories', 7)
ON CONFLICT (slug) DO NOTHING;
