-- Lot 2: track product views for "Pour vous" freshness (3-day hide window)

CREATE TABLE IF NOT EXISTS public.user_product_views (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_user_product_views_user_seen
  ON public.user_product_views (user_id, last_seen_at DESC);

ALTER TABLE public.user_product_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own product views" ON public.user_product_views;
CREATE POLICY "Users read own product views"
  ON public.user_product_views
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own product views" ON public.user_product_views;
CREATE POLICY "Users insert own product views"
  ON public.user_product_views
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own product views" ON public.user_product_views;
CREATE POLICY "Users update own product views"
  ON public.user_product_views
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_product_views TO authenticated;
