-- Purpose: SEO override for /discover marketing hub (Découvrir Zandofy).
-- Tables: public.seo_page_overrides
-- Rollback: DELETE FROM seo_page_overrides WHERE path = '/discover';
-- Risk (~4000+ users): none — metadata only; additive INSERT.

INSERT INTO public.seo_page_overrides (path, title, description, robots)
VALUES (
  '/discover',
  'Découvrir Zandofy | Marketplace Chine–Afrique',
  'Zandofy connecte acheteurs en Afrique et vendeurs : prix usine, logistique, paiement Mobile Money / carte, suivi de commande.',
  'index,follow'
)
ON CONFLICT (path) DO NOTHING;
