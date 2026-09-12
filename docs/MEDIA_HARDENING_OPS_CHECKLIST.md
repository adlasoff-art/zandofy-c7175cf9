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

1. Éditer produit avec photos → save sans changer médias → **mêmes ids** `product_images` (pas de re-insert) → photos intactes.
2. Remplacer photo principale → save → nouvelle vignette ; anciennes lignes orphelines purgées.
3. Ajouter 3–5 photos galerie → save → `position` 0 = cover, 1..N = galerie ; toutes visibles catalogue + PDP.
4. Brouillon sans photo → OK.
5. Soumettre sans photo → toast bloquant / bouton Send désactivé.
6. Upload fichier invalide → toast avec message Storage.
7. Produit `pending_approval` **ou** `revision_requested` : impossible d'enregistrer en vidant toutes les photos.
8. Après approbation admin : partage Facebook / social dialog inchangé (image cover disponible).

**Sécurité (ne pas casser)** : aucune migration Storage dans ce fix — bucket `product-media` public pour URLs connues ; upload toujours limité au dossier `{store_id}/` du owner. Ne pas rouvrir le listing anon. Les `id` d'images envoyés par le client ne sont acceptés que s'ils appartiennent déjà au `product_id` sauvegardé.

## 5. Smoke admin

1. Liste modération : bouton Approuver désactivé si 0 photo.
2. Détail produit : Approuver désactivé + message.
3. Tentative d'approuver sans photo (toute entrée y compris dialog social) → erreur explicite / bouton désactivé.
4. Approuver avec photos → PublishSocialDialog / Facebook comme avant.

