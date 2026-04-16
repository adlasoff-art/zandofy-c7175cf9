

# Diagnostic et correction : "Vous avez tout vu" — produits absents sur la page d'accueil

## Diagnostic

La capture d'écran montre que **toutes les sections produits sont vides** : Top Tendances (0 produit), Les Plus Populaires (pas affiché du tout), et Tendances (montre "Vous avez tout vu ✨" immédiatement).

**Cause racine** : `fetchProducts()` dans `frontend/src/services/api.ts` retourne `[]` silencieusement en cas d'erreur (ligne 204-206). Quand le résultat est vide, `hasMore` passe à `false` (car `0 < 24`), et le composant affiche "Vous avez tout vu" au lieu d'un message d'erreur. L'utilisateur croit qu'il n'y a aucun produit alors qu'en réalité **la requête a échoué**.

La cause probable de l'échec sur production : le `PRODUCT_SELECT` joint des colonnes qui peuvent ne pas exister sur la base de données de production (ex: `is_certified`, `verified_years_override`, `shop_type`, `trend_tag_id`) si les migrations n'ont pas toutes été appliquées. Supabase renvoie alors une erreur 400, que le code convertit en `[]`.

## Plan de correction

### 1. Ajouter un état d'erreur dans `ProductGrid.tsx`

Au lieu de montrer "Vous avez tout vu" quand le fetch échoue, distinguer entre :
- **0 résultat réel** → "Vous avez tout vu ✨"
- **Erreur de chargement** → "Impossible de charger les produits. Réessayer." avec bouton retry

Ajouter un state `error` et un mécanisme de retry.

### 2. Ajouter un état d'erreur dans `TopTrends.tsx`

Même logique : si `fetchProducts` retourne un tableau vide alors qu'on n'a jamais eu de données, afficher un message d'erreur au lieu de rien du tout.

### 3. Rendre `fetchProducts` plus transparent

Modifier `fetchProducts()` dans `api.ts` pour :
- Propager l'erreur Supabase au lieu de la masquer (ou retourner un objet `{ data, error }`)
- Ou a minima logger l'erreur avec suffisamment de détail pour le diagnostic

### 4. Rendre `PRODUCT_SELECT` plus résilient

Vérifier que les colonnes jointées (`is_certified`, `verified_years_override`, `shop_type` sur stores, `trend_tag_id` sur products) existent bien en production. Si une colonne manque, la requête entière échoue.

**Solution** : séparer la jointure en un fallback — si la requête principale échoue, retenter avec un SELECT plus basique (sans les colonnes récemment ajoutées).

### 5. Corriger l'erreur runtime `useState null`

L'erreur `Cannot read properties of null (reading 'useState')` dans `NotificationCenter` indique un problème d'import React. Le `SafeRadix` error boundary devrait la contenir, mais je vérifierai que c'est bien le cas et que ça ne cascade pas.

## Fichiers concernés

| Fichier | Modification |
|---------|-------------|
| `frontend/src/components/ProductGrid.tsx` | État erreur + retry au lieu de "Vous avez tout vu" |
| `frontend/src/components/TopTrends.tsx` | État erreur + retry |
| `frontend/src/services/api.ts` | Meilleur logging d'erreur, fallback SELECT |
| `frontend/src/hooks/use-notifications.ts` | Fix crash useState si nécessaire |

## Résultat attendu

- Les clients verront "Réessayer" au lieu de "Vous avez tout vu" quand les produits ne chargent pas
- Les erreurs Supabase seront visibles dans la console pour le diagnostic
- Si une colonne manque en production, un fallback basique chargera quand même les produits

