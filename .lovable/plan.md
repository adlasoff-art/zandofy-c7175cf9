## Problème

La section "Pour vous" sur la page d'accueil (`frontend/src/components/RecommendationsSection.tsx`) :
1. Affiche les titres en anglais car le composant utilise `p.name` (anglais) au lieu de `p.name_fr` selon la locale active. Tous les autres composants (ex. `ProductCard`) utilisent `locale === "fr" ? product.nameFr : product.name`.
2. Les 8 produits affichés sont toujours les mêmes (triés par `rating desc`, limit 30, prend les 8 premiers selon le genre) → effet "figé".

## Correction proposée

### 1. Titre dans la bonne langue

- Récupérer `name_fr` dans le `select` Supabase.
- Récupérer `locale` depuis `useI18n()`.
- Afficher `locale === "fr" ? p.nameFr || p.name : p.name`.
- Appliquer aussi au `alt` de l'image.
- Faire pareil dans le fallback `catch` (popular).

### 2. Ligne 1 stable, ligne 2 aléatoire à chaque chargement

Logique demandée :
- **4 premiers produits (ligne 1)** = recommandations stables basées sur le genre du profil + produits récemment consultés.
- **4 derniers produits (ligne 2)** = aléatoires à chaque actualisation (mix d'anciens et nouveaux), sans doublon avec ligne 1.

Implémentation :
- Élargir la requête à `limit(60)` (au lieu de 30) avec le tri actuel par `rating desc` pour la base personnalisée.
- Ligne 1 : prendre les 4 premiers du tri genre/intérêts existant (logique conservée mais tronquée à 4).
  - Bonus simple : intégrer les `viewed_products` (lus depuis `localStorage` clé existante si dispo, sinon ignorer) pour booster la pertinence.
- Ligne 2 : faire une 2ᵉ requête séparée
  - `select` produits publiés, `order` aléatoire côté client après un fetch large (par ex. `limit(80)` triés par `created_at desc` pour mixer anciens + nouveaux), puis shuffle Fisher-Yates et prendre 4 en excluant les IDs de la ligne 1.
  - Re-shuffle à chaque montage du composant (déjà le cas via `useEffect` au mount + clé `Date.now()` non nécessaire car le composant remount sur chaque navigation/refresh).
- Garder le même rendu visuel (grid 2/3/4 colonnes).

### 3. Pas de changements ailleurs

- Aucun changement DB / RLS / Edge Function.
- Aucun changement i18n (clés déjà existantes).
- Pas de modif des autres sections de la page d'accueil.

## Fichier modifié

- `frontend/src/components/RecommendationsSection.tsx` (uniquement)

## Validation

- Vérifier sur `/` en FR que les titres sont en français.
- Rafraîchir la page plusieurs fois : la ligne 1 reste stable, la ligne 2 change à chaque refresh.
- Switch locale EN → titres en anglais.

Approuves-tu pour que j'applique ?
