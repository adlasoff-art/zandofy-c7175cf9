

# Étiquettes d'expédition : i18n, poids/CBM, mode de transport

## Constat actuel

1. **Bouton "Print Labels"** et tout le contenu des étiquettes sont en anglais dur — aucune utilisation de `useI18n()`.
2. **Poids/dimensions** : les produits ont `weight_grams`, `length_cm`, `width_cm`, `height_cm` en base, mais l'Edge Function `generate-shipping-labels` et le composant `ShippingLabelPreview` ne les exploitent pas.
3. **Mode de transport (Air/Sea)** : les produits ont `can_ship_air` et `can_ship_sea` en base, mais la table `orders` n'a **aucune colonne** pour stocker le mode de transport choisi. Le checkout ne distingue pas Air vs Sea actuellement.
4. **CBM** : calculable depuis les dimensions produit (`L × W × H / 1 000 000`).

## Changements prévus

### 1. i18n du bouton et des étiquettes

**Fichiers** : `VendorOrderManager.tsx`, `ShippingLabelPreview.tsx`, `I18nContext.tsx`

- Ajouter les clés i18n : `print_labels`, `shipping_labels`, `no_labels`, `scan_qr_track`, `from`, `ship_to`, `order`, `track`, `mode`, `ship_cost`, `weight`, `dimensions`, `volume_cbm`, `home_delivery`, `hub_pickup`, `air`, `sea`, `items_count`, `print_btn`
- Remplacer tous les textes en dur par `t("clé")`
- Le bouton affichera "Imprimer étiquettes" en FR, "Print Labels" en EN

### 2. Poids et CBM sur les étiquettes

**Fichier** : `generate-shipping-labels/index.ts` (Edge Function)

- Enrichir la requête `order_items` pour joindre les produits avec `weight_grams`, `length_cm`, `width_cm`, `height_cm`
- Calculer par commande :
  - **Poids total** : somme de (`weight_grams × quantity`) → afficher en kg
  - **Volume CBM** : somme de (`L × W × H / 1 000 000 × quantity`)
  - **Dimensions estimées** : boîte englobante simplifiée (largeur max, profondeur max, somme des hauteurs)
- Retourner `totalWeightKg`, `totalVolumeCBM`, `estimatedDimensions` dans chaque label

**Fichier** : `ShippingLabelPreview.tsx`

- Ajouter les champs WEIGHT, DIMS, CBM dans le grid de détails
- N'afficher que si les valeurs sont > 0

### 3. Mode de transport (Air/Sea) — migration requise

**Migration SQL** :
- Ajouter `shipping_mode text` sur la table `orders` (nullable, valeurs : `air`, `sea`, `mixed`, null)
- Pas de contrainte, pas d'impact sur les commandes existantes (null = non défini)

**Edge Function** : retourner `shippingMode` depuis la commande

**ShippingLabelPreview** : afficher "Air" ou "Sea" à côté du MODE existant

### 4. Compatibilité produits Air/Sea — avertissement au checkout

**Fichier** : `CheckoutPage.tsx`

- Lors du calcul de shipping, vérifier `can_ship_air` et `can_ship_sea` de chaque produit
- Si le mode choisi est Air mais un produit n'a que `can_ship_sea = true`, afficher un avertissement : "Certains produits ne peuvent être expédiés que par voie maritime"
- Si mix incompatible, proposer de séparer les commandes ou changer de mode
- Stocker le `shipping_mode` choisi dans la commande

*Note : cette partie (checkout) est plus complexe et dépend du flux de sélection du mode de transport qui n'existe pas encore complètement. Je propose de l'implémenter en deux temps : d'abord les étiquettes (i18n + poids/CBM + affichage du mode), puis le checkout (sélection du mode + validation de compatibilité).*

## Fichiers concernés

| Action | Fichier |
|--------|---------|
| Modifier | `frontend/src/components/shipping/ShippingLabelPreview.tsx` — i18n + nouveaux champs |
| Modifier | `frontend/src/components/vendor/VendorOrderManager.tsx` — i18n bouton |
| Modifier | `frontend/supabase/functions/generate-shipping-labels/index.ts` — poids, CBM, dimensions, shipping_mode |
| Modifier | `supabase/functions/generate-shipping-labels/index.ts` — idem |
| Modifier | `frontend/src/contexts/I18nContext.tsx` — nouvelles clés |
| Migration | Ajouter `shipping_mode` sur `orders` |
| Phase 2 | `CheckoutPage.tsx` — sélection mode + validation compatibilité produits |

## Risque

Faible pour la phase 1 (étiquettes). Les calculs de poids/CBM sont en lecture seule. La colonne `shipping_mode` est nullable, zéro impact sur les commandes existantes. La phase 2 (checkout) nécessitera plus de réflexion sur le flux UX.

