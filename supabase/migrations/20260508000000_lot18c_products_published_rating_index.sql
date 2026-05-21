-- =====================================================================
-- Lot 18C — Disk IO mitigation (suite Lot 18B)
-- =====================================================================
-- Contexte : alerte Supabase "Disk IO budget" persiste en prod (vpt…yxf).
-- Analyse du CSV Query Performance : 80 % du temps DB vient de
-- realtime.list_changes + 10 % des heartbeats de présence. Côté requêtes
-- applicatives, la liste produits anon (homepage / catalogue public)
-- ORDER BY rating DESC tape un seq scan car aucun index ne couvre
-- (publish_status='published') + tri par rating.
--
-- Cette migration ajoute UN SEUL index partiel, très petit, zéro impact
-- sur les writes (ne couvre que les produits publiés).
--
-- Procédure (cf. mem://architecture/rls-staging-prod-divergence) :
--   1. Appliquer en STAGING via SQL Editor.
--   2. Vérifier le plan d'exécution avec EXPLAIN ANALYZE de la requête
--      anon homepage (publish_status='published' ORDER BY rating DESC LIMIT 20).
--   3. Rejouer EXACTEMENT le même fichier en PROD.
--
-- Idempotent : IF NOT EXISTS.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_products_published_rating
  ON public.products (rating DESC NULLS LAST, created_at DESC)
  WHERE publish_status = 'published';

-- =====================================================================
-- Vérification post-migration :
--
-- EXPLAIN ANALYZE
-- SELECT id, name, price, rating
-- FROM public.products
-- WHERE publish_status = 'published'
-- ORDER BY rating DESC NULLS LAST
-- LIMIT 20;
--
-- Le plan doit utiliser idx_products_published_rating (Index Scan), pas
-- de Seq Scan + Sort.
-- =====================================================================