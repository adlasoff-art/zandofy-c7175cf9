

# Plan — Corrections multiples (Buckets, Featured, Promos, Claims, Multi-boutique)

## 1. Documents KYB — Bucket 404 (Critique)

**Problème** : Le bucket `vendor-documents` est **privé** (`public: false`), mais le code utilise `getPublicUrl()` qui ne fonctionne que pour les buckets publics. Les URLs générées retournent 404.

**Solution** :
- Dans `BecomeVendorPage.tsx` : remplacer `getPublicUrl()` par `createSignedUrl()` avec une longue durée (ex: 10 ans = 315360000 secondes) pour stocker l'URL signée dans `vendor_documents.document_url`
- Dans `AdminVendorApplicationsPage.tsx` : utiliser `createSignedUrl()` au moment de l'affichage pour générer des URLs temporaires à la volée (1h de validité) au lieu d'utiliser les URLs stockées directement
- Vérifier tous les autres buckets privés (`kyc-documents`) — même correctif si applicable

**Fichiers modifiés** :
- `frontend/src/pages/BecomeVendorPage.tsx` — stocker le path relatif au lieu de l'URL publique
- `frontend/src/pages/admin/AdminVendorApplicationsPage.tsx` — générer des signed URLs à l'affichage

---

## 2. Mise en avant — "Aucun produit approuvé disponible"

**Problème** : Le filtre utilise `publish_status = "approved"` mais le statut des produits publiés est `"published"` (pas `"approved"`).

**Solution** :
- Corriger le filtre dans `VendorFeaturedRequestTab.tsx` : `.eq("publish_status", "published")`
- Ajouter un **sélecteur de type** : "Produit approuvé" ou "Autre (annonce libre)"
  - Si "Produit" → afficher la liste des produits publiés avec sélection
  - Si "Autre" → masquer la liste produits, afficher un champ **lien interne** (autocomplete routes internes : `/store/...`, `/category/...`, etc.) + image + message
- La validation du formulaire accepte l'un ou l'autre mode
- Ajouter un champ `request_type` (`product` | `custom`) et `internal_link` au submit

**Fichiers modifiés** :
- `frontend/src/components/vendor/VendorFeaturedRequestTab.tsx`

**Migration SQL** : Ajouter les colonnes `request_type` et `internal_link` à `featured_placement_requests`

---

## 3. Promotions — Édition des dates et limites par badge

**Problème** : Pas de possibilité de modifier les dates de promo d'un produit déjà en promotion. Pas de limite de produits en promo selon le badge vendeur.

**Solution** :
- Ajouter dans `VendorPromotionsTab.tsx` un **bouton d'édition** sur chaque produit en promo (actif/planifié) ouvrant un mini-dialogue pour modifier :
  - Date de début
  - Date de fin
  - Pourcentage de réduction
- Ajouter les **limites de promo simultanées par badge** dans `vendor-tiers.ts` :
  - Beginner : 3 promos simultanées max
  - Pro : 25 promos simultanées max
  - Grand Supplier : 50 promos simultanées max
- Vérifier la limite avant d'activer une promo (toggle ou bulk)

**Fichiers modifiés** :
- `frontend/src/components/vendor/VendorPromotionsTab.tsx` — dialogue édition + vérification limite
- `frontend/src/lib/vendor-tiers.ts` — ajouter `maxPromos` par tier

---

## 4. Claims 72h — Auto-expiration et bouton ticket support

**Problème** : Les messages de revendication restent affichés au-delà de 72h. Pas de bouton pour ouvrir un ticket de réclamation.

**Solution** :
- Dans `VendorPlatformClaimBanner.tsx`, quand le claim est expiré, ajouter un **bouton "Ouvrir un ticket de réclamation"** qui redirige vers `/help-center` avec des paramètres pré-remplis (sujet = nom de la boutique, catégorie = "account")
- Le banner doit disparaître (ou se réduire) si le claim est expiré ET résolu/contesté

**Fichiers modifiés** :
- `frontend/src/components/vendor/VendorPlatformClaimBanner.tsx`

---

## 5. Multi-boutique — Demande d'ajout d'une nouvelle boutique

**Solution** :
- Ajouter dans le dashboard vendeur un bouton **"Ajouter une boutique"** qui redirige vers `/become-vendor` (le formulaire existant)
- Adapter `BecomeVendorPage.tsx` pour détecter qu'un utilisateur est déjà vendeur et permettre de soumettre une nouvelle demande de boutique (au lieu de bloquer)
- Côté admin (`AdminVendorApplicationsPage.tsx`), le flux d'approbation crée déjà une nouvelle boutique — il n'y a pas de contrainte d'unicité à lever

**Fichiers modifiés** :
- `frontend/src/pages/VendorDashboardPage.tsx` — bouton "Ajouter une boutique"
- `frontend/src/pages/BecomeVendorPage.tsx` — permettre les demandes multiples

---

## 6. Wallet — Vérification opérationnelle

Vérifier que les composants wallet (solde, historique transactions, demande de retrait) fonctionnent correctement avec les données existantes et ne crashent pas à vide.

**Fichiers vérifiés** (lecture seule, corrections si nécessaire) :
- Composants wallet vendeur existants

---

## Migration SQL requise

```sql
-- Colonnes pour featured_placement_requests
ALTER TABLE featured_placement_requests 
  ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS internal_link text;
```

## Résumé des fichiers

| Fichier | Action |
|---|---|
| `BecomeVendorPage.tsx` | Fix signed URL + multi-boutique |
| `AdminVendorApplicationsPage.tsx` | Fix signed URL affichage docs |
| `VendorFeaturedRequestTab.tsx` | Fix filtre `published` + type annonce |
| `VendorPromotionsTab.tsx` | Édition dates promo + limites badge |
| `vendor-tiers.ts` | Ajouter `maxPromos` |
| `VendorPlatformClaimBanner.tsx` | Bouton ticket réclamation |
| `VendorDashboardPage.tsx` | Bouton multi-boutique |
| Migration SQL | `request_type` + `internal_link` |

