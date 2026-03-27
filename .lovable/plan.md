

## Plan: Corriger l'erreur "Mise à jour" des produits vendeur

### Diagnostic

Apres audit complet :
- Toutes les colonnes existent dans la base (y compris `model_size`, `cost_real`, `cost_calc`, `trend_tag_id`, etc.)
- Les politiques RLS sont correctes (store owners can update their own products)
- Aucun trigger ni contrainte CHECK sur la table products
- Pas de conflit de clé etrangere evident

**Probleme identifie** : La colonne `discount` est de type `integer` dans la base de donnees, mais le formulaire pourrait envoyer une valeur decimale. De plus, l'erreur Supabase n'est jamais loguee dans la console (pas de `console.error`), rendant le diagnostic impossible.

### Corrections

**Fichier** : `frontend/src/components/VendorProductManager.tsx`

1. **Ajouter `console.error`** sur la ligne 385 pour que l'erreur reelle soit visible dans la console lors du prochain echec
2. **Forcer `discount` en entier** : `Math.round(form.discount || 0)` pour eviter un rejet par le type `integer`
3. **Proteger les champs numeriques** : s'assurer que `weight_grams`, `moq` sont bien des entiers (correspondant aux types `integer` de la base)
4. **Nettoyer les UUIDs vides** : verifier que `category_id` et `trend_tag_id` ne sont jamais envoyes comme chaines vides (deja fait avec `|| null`, mais ajouter une verification explicite pour les cas limites)

### Impact
- Aucune migration SQL necessaire
- Modification d'un seul fichier
- Le `console.error` permettra de diagnostiquer tout probleme residuel

