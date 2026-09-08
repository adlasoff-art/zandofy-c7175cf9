# Checklist ops — médias après fix code

À faire **manuellement** (hors deploy) une fois le code déployé.

## 1. RLS `product_images` (lecture seule)

SQL Editor staging puis prod :

```sql
SELECT polname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'product_images'
ORDER BY cmd, polname;
```

Attendu : policies permettant au vendeur owner (via `stores.owner_id`) de SELECT/INSERT/UPDATE/DELETE sur les images de ses produits. Si INSERT vendeur échoue en smoke → migration policy additive séparée.

## 2. Logos plateforme

1. Admin → CMS → Branding.
2. Re-upload **Logo Header** + **Logo Footer** (+ favicon si cassé) vers bucket `cms-assets`.
3. Hard refresh `https://www.zandofy.com` et `/admin` : logo visible (sinon fallback texte/Z sans icône brisée).

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

Pour chaque ligne : dashboard vendeur (ou admin) → re-upload photos → sauvegarder → vérifier vignette. Ne pas approuver tant que `nb_photos = 0`.

## 4. Smoke vendeur (après deploy)

1. Éditer produit avec photos → save sans changer médias → photos intactes.
2. Remplacer photo principale → save → nouvelle vignette.
3. Brouillon sans photo → OK.
4. Soumettre sans photo → toast bloquant / bouton Send désactivé.
5. Upload fichier invalide → toast avec message Storage.
