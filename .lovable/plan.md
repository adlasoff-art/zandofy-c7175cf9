

## Plan : Correction seuil maritime + élimination du recalcul multiple

### Problème 1 — Seuil maritime basé sur le mauvais critère

**Actuel** : Le maritime est bloqué si `cartSubtotal < seuil` (sous-total panier).
**Attendu** : Le maritime est bloqué si le **coût de fret maritime calculé** (poids × dimensions × quantité → frais) est inférieur au seuil ($49). C'est le montant du fret maritime lui-même qui doit atteindre le seuil, pas le sous-total des produits.

#### Changements dans `CheckoutShippingCalculator.tsx`

- **Ligne 312** : Remplacer la logique `isSeaBlocked`. Au lieu de comparer `cartSubtotal` au seuil, comparer `modeTotals.get("sea")?.total` au seuil.
- **Ligne 447-450** : Adapter le message d'alerte pour indiquer le montant de fret maritime manquant (ex: "Le fret maritime est de $32 — il faut atteindre $49 de frais maritime pour débloquer ce mode").
- **Admin label** (ligne 1113-1114 de `AdminShippingPage.tsx`) : Corriger la description pour refléter la vraie logique : "Montant minimum de fret maritime pour activer ce mode" au lieu de "montant minimum de commande".

### Problème 2 — Calcul qui tourne 3 fois

**Cause** : L'effet de calcul (ligne 215) dépend de `[destCity, products, originCities, selectedMode]`. Ces 3 états sont résolus par 3 `useEffect` en cascade, chacun déclenchant un recalcul avec `setLoading(true)` → résultat → `setLoading(false)` → nouvel état → re-trigger.

#### Solution : Calcul unique déclenché quand toutes les données sont prêtes

- Ajouter un flag `dataReady` qui n'est `true` que quand `products.length > 0 && destCity !== null && originCities.size >= nombre de pays distincts`.
- L'effet de calcul (ligne 215) ne se déclenche que quand `dataReady` passe à `true`, pas à chaque changement intermédiaire.
- Alternative plus propre : remplacer les 3 useEffect cascadés par un seul `useEffect` qui résout séquentiellement (fetch products → fetch origins → fetch dest → calcul) en une seule passe, avec un seul `setLoading(true)` au début et un seul `setLoading(false)` à la fin.

#### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `frontend/src/components/CheckoutShippingCalculator.tsx` | Logique seuil maritime + stabilisation du calcul |
| `frontend/src/pages/admin/AdminShippingPage.tsx` | Label/description corrigés pour le seuil maritime |

### Résumé technique

1. `isSeaBlocked` = `seaThreshold.enabled && (seaQuoteTotal < seaThreshold.min_subtotal)`
2. Consolidation des useEffect en un seul flux : produits → villes → calcul, avec un unique cycle loading.
3. Mise à jour du message utilisateur pour mentionner le fret maritime plutôt que le sous-total panier.

