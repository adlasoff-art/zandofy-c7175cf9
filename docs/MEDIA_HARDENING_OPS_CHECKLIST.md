# Checklist ops — médias après fix code

## 0. MIGRATION OBLIGATOIRE (staging → prod)

Sans cette étape, le frontend affichera une erreur explicite à la sauvegarde des photos.

Fichier : `supabase/migrations/20260912140000_product_gallery_sync_rpc_and_rls.sql`

1. SQL Editor **staging** → coller le fichier entier → Run.
2. Smoke vendeur staging (section 4).
3. SQL Editor **production** → **même fichier** → Run.
4. Puis déployer / hard-refresh le frontend (Vercel `main`).

Vérif rapide après SQL :

```sql
SELECT proname FROM pg_proc WHERE proname = 'sync_product_gallery';
SELECT polname, cmd FROM pg_policies WHERE tablename = 'product_images' ORDER BY cmd, polname;
```

## 1. RLS `product_images`

```sql
SELECT polname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'product_images'
ORDER BY cmd, polname;
```

Attendu : `Public read product_images` (SELECT) + policies owner INSERT/UPDATE/DELETE (+ admin/manager).

## 2. Logos plateforme

1. Admin → CMS → Branding.
2. Re-upload **Logo Header** + **Logo Footer** (+ favicon si cassé) vers bucket `cms-assets`.
3. Hard refresh `https://www.zandofy.com` et `/admin`.

## 3. Produits orphelins (sans `product_images`)

```sql
SELECT p.id, p.name_fr, p.publish_status, p.store_id, p.created_at
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
)
AND p.publish_status IN ('pending_approval', 'published', 'draft')
ORDER BY p.created_at DESC;
```

Pour chaque ligne : dashboard vendeur → re-upload photos → sauvegarder → vérifier vignette.

## 4. Smoke vendeur (après SQL + deploy)

1. Upload principale + 3 galerie → **attendre fin upload** → Mettre à jour → toast succès.
2. Catalogue : vignette visible ; si `draft` → bouton **Send** actif.
3. Si produit était `published` → statut **En attente** + pastille « En validation » (pas de Send : déjà en file admin).
4. Save pendant upload → bouton désactivé (« Upload des photos… »).
5. Soumettre draft sans photo → bloqué.
6. Approuver admin + Facebook comme avant.

**Sécurité** : RPC `sync_product_gallery` = SECURITY DEFINER mais **owner/admin/manager only**. SELECT public des images catalogue conservé. Upload Storage toujours `{store_id}/`.
