

# Plan : Corriger les seuils de marge vendeur et valider le flux complet

## Constat

Le code est **déjà fonctionnel** dans sa structure :
- Le toggle admin `vendor_extra_margin_enabled` existe dans `vendor_pricing_overrides` (DB ✅)
- La colonne `vendor_extra_margin` existe dans `products` (DB ✅)
- Le champ s'affiche dans `PricingCalculator.tsx` quand le toggle est activé (UI ✅)
- Le calcul de prix intègre la marge vendeur (logique ✅)

## Problème identifié

La fonction `getMaxExtraMargin()` dans `pricing-utils.ts` utilise un seuil de **$50** au lieu de **$99** :
- Actuellement : < $50 → $0.50, ≥ $100 → $1.00, entre $50-$100 → interpolation
- Attendu : < $100 → $0.50, ≥ $100 → $1.00 (pas d'interpolation)

## Modifications

### 1. Corriger `getMaxExtraMargin()` dans `pricing-utils.ts`
Remplacer la logique d'interpolation par un seuil net à $100 :
- Prix < $100 → max $0.50
- Prix ≥ $100 → max $1.00

### 2. Valider le clamp côté `PricingCalculator.tsx`
S'assurer que quand le prix change (recalcul auto), la valeur `vendorExtraMargin` est automatiquement réduite si elle dépasse le nouveau max autorisé.

### 3. Aucune migration nécessaire
Toutes les colonnes et tables sont déjà en place dans la base de données.

## Fichiers modifiés
| Fichier | Modification |
|---|---|
| `frontend/src/lib/pricing-utils.ts` | Seuil $100 net au lieu de $50/$100 interpolé |
| `frontend/src/components/vendor/PricingCalculator.tsx` | Auto-clamp de la marge si elle dépasse le max après recalcul |

