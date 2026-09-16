# Checklist ops — store public visibility (ban / suspend / soft-archive)

## Objectif

Masquer du catalogue public toute boutique `is_banned OR is_suspended OR deleted_at IS NOT NULL`, **sans** mass-unpublish des produits et **sans** hard-delete boutique/commandes.

## Migration (staging → production)

**Ordre obligatoire :**

1. `supabase/migrations/20260914120000_store_public_visibility.sql`  
   → crée `deleted_at*`, `store_is_publicly_visible()`, `stores_public` filtré, **`stores_seo`**, `products_public` filtré, lock modération.
2. (Optionnel) `supabase/migrations/20260916120000_store_visibility_moderation_lock.sql`  
   → seulement si le fichier (1) a déjà été joué **sans** le lock / REVOKE ; skippe les vues absentes.

Ne pas lancer le fichier (2) seul en premier : sans (1), `stores_seo` n’existe pas.

### Vérifs SQL post-migration

```sql
-- Colonnes soft-archive
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stores'
  AND column_name IN ('deleted_at', 'deleted_by', 'delete_reason');

-- Helper
SELECT public.store_is_publicly_visible(s.*)
FROM public.stores s
LIMIT 1;

-- Vues
SELECT COUNT(*) FROM public.stores_public;
SELECT COUNT(*) FROM public.products_public;
SELECT COUNT(*) FROM public.stores_seo;

-- Boutique bannie absente du public, présente en SEO lookup
-- (remplacer :banned_id)
-- SELECT id FROM stores_public WHERE id = ':banned_id';  -- 0 rows
-- SELECT id, is_banned FROM stores_seo WHERE id = ':banned_id'; -- 1 row
```

## Smoke staging

1. Boutique saine : visible `/stores`, PDP embed store OK, sitemap vendor URL présente.
2. Suspendre en admin → absente `/stores` + produits absents catalogue ; fiche `/store/...` « indisponible » ; HTTP meta 410 si applicable.
3. Lever suspend → retour catalogue si pas ban/archive.
4. Bannir → même masquage ; débannir → retour.
5. Archiver (soft) → masquée ; Restaurer → retour si pas ban/suspend.
6. Admin table `stores` : ligne toujours visible (filtres Active / Suspendue / Bannie / Archivée).
7. Commande historique client/admin : toujours lisible (pas via `stores_public`).
8. Vendeur : dashboard accessible ; banner Archivée/Bannie/Suspendue ; catalogue lecture seule si bloqué.

## Hard delete — hors V1 (interdit self-serve)

**Ne pas** ajouter de bouton « Supprimer définitivement » dans l’UI actuelle.

Raisons (~4000+ users) : litiges, wallet, commandes, Storage, SEO, preuves livraison.

Futur éventuel seulement via RPC admin dédiée (ex. `request_store_purge`) avec garde-fous :

- soft-archive préalable (`deleted_at` set) ;
- 0 commandes ouvertes / litiges actifs ;
- anonymisation contrôlée ;
- **jamais** `DELETE CASCADE` depuis la modération boutique actuelle.

Jusqu’à ce design : Archiver = soft only ; Storage et `orders` / `product_images` **conservés**.

## Harden (audit senior — 2026-09-16)

Si `20260914120000` a déjà été exécuté **avant** le lock modération / REVOKE, exécuter aussi :

`supabase/migrations/20260916120000_store_visibility_moderation_lock.sql`

Sinon (fichier `20260914120000` à jour non encore appliqué) : un seul Run du fichier I0 mis à jour suffit (inclut §7).

Vérif lock :

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_protect_store_moderation_columns';
```

## Risque

Faible si colonnes des vues publiques restent compatibles PostgREST. Tester embed PDP `store:stores_public(...)`. Admin / withdrawals / compta restent sur table `stores`. Store page : `stores_public` d’abord, puis `stores_seo` pour l’état indisponible.
