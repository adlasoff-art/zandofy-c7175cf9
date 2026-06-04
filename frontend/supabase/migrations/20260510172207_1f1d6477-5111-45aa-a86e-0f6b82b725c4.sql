
-- Per-page SEO overrides (RankMath-style)
CREATE TABLE IF NOT EXISTS public.seo_page_overrides (
  path TEXT PRIMARY KEY,
  title TEXT,
  og_title TEXT,
  description TEXT,
  og_image TEXT,
  keywords TEXT[],
  robots TEXT NOT NULL DEFAULT 'index,follow',
  jsonld_extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_page_overrides ENABLE ROW LEVEL SECURITY;

-- Public can read (used by edge meta-injector + client SEOHead)
CREATE POLICY "seo_page_overrides_public_read"
  ON public.seo_page_overrides FOR SELECT
  USING (true);

-- Admins can write (insert/update/delete)
CREATE POLICY "seo_page_overrides_admin_insert"
  ON public.seo_page_overrides FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "seo_page_overrides_admin_update"
  ON public.seo_page_overrides FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "seo_page_overrides_admin_delete"
  ON public.seo_page_overrides FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER trg_seo_page_overrides_updated_at
  BEFORE UPDATE ON public.seo_page_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed all global routes
INSERT INTO public.seo_page_overrides (path, title, og_title, description, robots) VALUES
  ('/',          'Zandofy — Marketplace sino-africaine d''import',
                 'Zandofy — Marketplace sino-africaine | Achat à l''international et livraison en Afrique',
                 'Zandofy connecte l''Afrique aux usines chinoises, turques et internationales. Sourcing vérifié, logistique intégrée, livraison rapide en Afrique.',
                 'index,follow'),
  ('/stores',    'Boutiques vérifiées — Zandofy', 'Boutiques sino-africaines vérifiées sur Zandofy',
                 'Découvrez toutes les boutiques certifiées Zandofy : mode, électronique, maison. Achat sécurisé et livraison en Afrique.', 'index,follow'),
  ('/pricing',   'Tarifs & abonnements — Zandofy', NULL,
                 'Tarifs Zandofy : commissions, frais d''expédition, abonnements vendeurs et acheteurs. Transparent et sans surprise.', 'index,follow'),
  ('/about',     'À propos de Zandofy', NULL,
                 'Zandofy : la marketplace qui connecte les acheteurs africains aux usines internationales avec une logistique intégrée.', 'index,follow'),
  ('/faq',       'FAQ — Zandofy', NULL,
                 'Toutes les réponses sur l''achat, la livraison, les paiements et le support Zandofy.', 'index,follow'),
  ('/help',      'Centre d''aide — Zandofy', NULL,
                 'Guides, tutoriels et support pour acheteurs et vendeurs Zandofy.', 'index,follow'),
  ('/careers',   'Carrières — Zandofy', NULL,
                 'Rejoignez l''équipe Zandofy et participez à la révolution du commerce sino-africain.', 'index,follow'),
  ('/blog',      'Blog Zandofy — actualités import & e-commerce', NULL,
                 'Conseils, guides et actualités sur l''import depuis la Chine et le e-commerce en Afrique.', 'index,follow'),
  ('/popular',   'Produits populaires — Zandofy', NULL,
                 'Les produits les plus achetés sur Zandofy. Tendances, best-sellers et nouveautés.', 'index,follow'),
  ('/trends',    'Tendances — Zandofy', NULL,
                 'Découvrez les tendances mode, tech et lifestyle sur la marketplace sino-africaine Zandofy.', 'index,follow'),
  ('/search',    'Recherche — Zandofy', NULL,
                 'Trouvez tous les produits, boutiques et catégories disponibles sur Zandofy.', 'index,follow'),
  ('/privacy',   'Politique de confidentialité — Zandofy', NULL,
                 'Comment Zandofy protège vos données personnelles.', 'index,follow'),
  ('/terms',     'Conditions générales — Zandofy', NULL,
                 'Conditions générales d''utilisation de la marketplace Zandofy.', 'index,follow'),
  -- Private pages: noindex
  ('/auth',           NULL, NULL, NULL, 'noindex,nofollow'),
  ('/reset-password', NULL, NULL, NULL, 'noindex,nofollow'),
  ('/onboarding',     NULL, NULL, NULL, 'noindex,nofollow'),
  ('/impersonate',    NULL, NULL, NULL, 'noindex,nofollow')
ON CONFLICT (path) DO NOTHING;
