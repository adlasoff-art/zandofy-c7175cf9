
**Objectif** : Réduire la pression I/O sur la stack prod en éliminant les full table scans sur `product_images/colors/sizes`.

**Étape 1 — SQL migration `04_perf_listings.sql`** (fichier téléchargeable pour run manuel sur staging puis prod)
- Covering index `idx_product_images_product_position ON product_images(product_id, position)` pour servir la première image sans toucher la table
- Index partiel `idx_product_images_primary ON product_images(product_id) WHERE position = 0` (alternative plus compacte)
- `ANALYZE` final sur les 3 tables

**Étape 2 — Refactor frontend `src/lib/api.ts`**
- Créer un fragment `PRODUCT_LIST_SELECT` léger : exclure `product_colors`, `product_sizes`, `product_pricing_tiers` ; garder seulement `product_images(image_url, position)` avec `order=position.asc&limit=1`
- Garder `PRODUCT_SELECT` complet uniquement pour `ProductDetailPage`

**Étape 3 — Ajouter pagination/limites dans les pages de listing**
- `src/pages/CategoryPage.tsx` : ajouter `.range(0, 47)` (48 produits) ou `.limit(48)`
- `src/pages/PopularPage.tsx` : vérifier `.limit()`
- `src/lib/search.ts` : confirmer le cap

**Étape 4 — Vérification post-deploy** (24h après merge prod)
- Re-query `pg_stat_user_tables` pour mesurer le delta `seq_scan` sur `product_images`
- Objectif : ratio `idx_scan / seq_scan` > 10:1

**Aucune modification** sur : auth, RLS, edge functions, storage, paiements.
**Stack ciblée** : prod (Supabase.com perso `vpt...yxf`) — tests d'abord sur staging.
