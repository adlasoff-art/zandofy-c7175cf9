

# Ajouter "Fournisseurs" au menu mobile compte (PWA)

## Problème

Sur la version mobile/PWA, les vendeurs n'ont pas d'accès direct à la page Fournisseurs depuis le menu Compte. Le lien n'apparaît que dans les onglets du dashboard vendeur, difficilement accessibles sur mobile.

## Solution

Ajouter un lien "Fournisseurs" dans la section **"Mes interfaces"** du `MobileAccountMenu.tsx`, visible uniquement pour les vendeurs. Ce lien redirigera vers `/vendor?tab=suppliers` (le dashboard vendeur avec l'onglet fournisseurs pré-sélectionné).

Comme l'accès aux fournisseurs dépend du flag `suppliers_enabled` (dans `vendor_pricing_overrides`), il faut aussi vérifier ce flag pour n'afficher le lien que si la fonctionnalité est activée pour la boutique du vendeur.

## Fichier modifié

| Fichier | Modification |
|---|---|
| `frontend/src/components/MobileAccountMenu.tsx` | Ajouter une requête pour vérifier `suppliers_enabled` + lien conditionnel "Fournisseurs" dans la section "Mon espace" (visible si `isVendor && suppliersEnabled`) pointant vers `/vendor?tab=suppliers` |

## Détail

1. Importer `useEffect`/`useState` et `supabase` dans `MobileAccountMenu.tsx`
2. Récupérer le `store_id` du vendeur connecté puis vérifier `suppliers_enabled` dans `vendor_pricing_overrides`
3. Ajouter dans la section "Mon espace" (après "Messages") un item conditionnel :
   ```
   { to: "/vendor?tab=suppliers", icon: Truck, label: "Fournisseurs" }
   ```
   visible uniquement si `isVendor && suppliersEnabled`

## Risque

Faible — ajout d'un lien conditionnel, aucun impact sur les autres rôles.

