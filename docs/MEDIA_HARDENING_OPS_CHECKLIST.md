# Checklist ops — médias après fix code

## 0. MIGRATION OBLIGATOIRE (staging → prod)

Fichier unique à coller (version auditée) :

`supabase/migrations/20260912140000_product_gallery_sync_rpc_and_rls.sql`

1. SQL Editor **staging** → Run le fichier entier.
2. Smoke vendeur (section 4).
3. SQL Editor **production** → **même fichier** → Run.
4. Merge/deploy frontend `develop` → `main` + hard refresh.

Si une **ancienne** version du fichier a déjà été exécutée : re-coller ce fichier (il est idempotent : `CREATE OR REPLACE` + `DROP POLICY IF EXISTS`).

Vérif :

```sql
SELECT proname FROM pg_proc WHERE proname = 'sync_product_gallery';
SELECT polname, cmd FROM pg_policies WHERE tablename = 'product_images' ORDER BY cmd, polname;
-- Doit échouer (forbidden) si appelé sans auth — test owner via app
```

## 1. Smoke vendeur

1. Upload cover + 3 galerie → attendre fin upload → sauver → vignettes visibles.
2. Re-sauver sans changer photos → toujours OK (embeddings non reset).
3. Draft → bouton Send ; publié modifié → « En validation » (pas de Send).
4. Collaborateur avec permission `products` peut sauver la galerie.
5. URL hors `product-media` refusée à la sauvegarde.

## 2. Sécurité attendue

| Contrôle | Attendu |
|----------|---------|
| SELECT public images | Conservé (`USING true`) — catalogue public |
| INSERT/UPDATE/DELETE | Owner **ou** collab `products` **ou** admin/manager |
| RPC | SECURITY DEFINER + authz stricte + max 30 + URL product-media |
| Storage upload | Toujours `{store_id}/…` |

## 3. Produits orphelins

```sql
SELECT p.id, p.name_fr, p.publish_status
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id)
  AND p.publish_status IN ('pending_approval', 'published', 'draft')
ORDER BY p.created_at DESC;
```
