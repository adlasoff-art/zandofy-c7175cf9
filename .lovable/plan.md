

## Problème

Les bannières de boutique utilisent `object-cover` qui zoome/recadre l'image pour remplir l'espace. Avec une image de ratio différent (ex: 1200×180 vs espace 1200×256), l'image est coupée et floue.

## Solution

Remplacer `object-cover` par `object-contain` avec un fond harmonieux, pour que l'image entière soit visible sans zoom ni recadrage, quelle que soit sa résolution.

## Modifications

### 1. `StorePage.tsx` — Bannière principale de la boutique (ligne 291)
- Changer `object-cover` → `object-contain`
- Ajouter `bg-muted` sur le conteneur pour combler l'espace autour si l'image ne remplit pas tout

### 2. `StoresPage.tsx` — Carte boutique dans la liste (ligne 112)
- Changer `object-cover` → `object-contain`
- Retirer le `group-hover:scale-105` (le zoom au survol perd son sens avec contain)
- Ajouter `bg-muted` sur le conteneur

### 3. `VendorDashboardPage.tsx` — Prévisualisation bannière dans le dashboard vendeur
- Vérifier et appliquer le même traitement `object-contain` si applicable

### 4. Compression (`image-compress.ts`)
- Augmenter `maxSize` par défaut de 1600 à 2000 et `quality` de 0.85 à 0.92 pour les bannières (ou ne pas compresser les images déjà ≤ la taille cible)

## Résumé
L'image sera contenue intégralement dans l'espace prévu, sans zoom ni recadrage, avec un fond neutre derrière si elle ne remplit pas exactement les dimensions.

