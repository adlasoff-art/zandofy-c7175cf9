-- Purpose: Align seo_page_overrides paths with real app routes (/help-center) and add hub pages.
-- Tables: public.seo_page_overrides
-- Rollback: reverse UPDATEs / DELETEs for new paths if needed.
-- Risk: Low — metadata only; no user data.

-- Migrate legacy /help → /help-center
UPDATE public.seo_page_overrides
SET path = '/help-center', updated_at = now()
WHERE path = '/help';

-- Ensure hub pages exist (idempotent upserts)
INSERT INTO public.seo_page_overrides (path, title, description, robots)
VALUES
  ('/help-center', 'Centre d''aide | Zandofy', 'FAQ, guides et support client Zandofy — marketplace sino-africaine.', 'index,follow'),
  ('/become-vendor', 'Devenir vendeur | Zandofy', 'Vendez sur Zandofy : accès usines, logistique Chine–Afrique, clients en Afrique.', 'index,follow'),
  ('/affiliate-program', 'Programme d''affiliation | Zandofy', 'Parrainez et gagnez avec le programme d''affiliation Zandofy.', 'index,follow'),
  ('/loyalty-program', 'Programme de fidélité | Zandofy', 'Cumulez des points et récompenses sur Zandofy.', 'index,follow'),
  ('/social-responsibility', 'Responsabilité sociale | Zandofy', 'Engagements sociaux et commerce équitable Zandofy.', 'index,follow')
ON CONFLICT (path) DO NOTHING;

-- Drop obsolete contact override if present (redirects to /faq)
DELETE FROM public.seo_page_overrides WHERE path = '/contact';
