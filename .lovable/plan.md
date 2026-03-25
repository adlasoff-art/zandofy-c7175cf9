

# Plan — Compression d'images à l'upload + optimisation d'affichage

## Objectif
Compresser automatiquement les images côté client avant upload (Canvas API → WebP 85%, max 1600px) pour garantir des images nettes et légères. Aucune cassure sur l'existant.

## Fichiers à créer

| Fichier | Rôle |
|---|---|
| `frontend/src/utils/image-compress.ts` | Fonction `compressImage(file, maxSize=1600, quality=0.85)` → retourne un `File` WebP (fallback JPEG) via Canvas API |

## Fichiers à modifier

| Fichier | Modification |
|---|---|
| `frontend/src/components/vendor/MediaUploader.tsx` | Appeler `compressImage()` avant chaque `supabase.storage.upload()` pour les fichiers image |
| `frontend/src/components/PaymentProofUpload.tsx` | Appeler `compressImage()` avant upload des preuves de paiement |
| `frontend/src/pages/VendorDashboardPage.tsx` | Compression logo/bannière boutique avant upload |
| `frontend/src/pages/DashboardPage.tsx` | Compression avatar utilisateur avant upload |
| `frontend/src/components/ProductCard.tsx` | Ajouter `decoding="async"` sur les `<img>` |

## Logique de compression (image-compress.ts)

1. Créer un `Image()` à partir du fichier
2. Calculer les dimensions finales (max 1600px, ratio conservé)
3. Dessiner sur un `<canvas>` aux dimensions calculées
4. Exporter en `image/webp` qualité 0.85 (fallback `image/jpeg` si WebP non supporté)
5. Retourner un nouveau `File` avec extension `.webp`
6. Ne pas toucher aux fichiers vidéo — compression images uniquement

## Aucune migration SQL nécessaire

