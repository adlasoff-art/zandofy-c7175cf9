

# Plan : Système de Pricing Intelligent pour Vendeurs

## Résumé

Ajouter un module de calcul automatique des prix dans le formulaire produit vendeur. Le vendeur renseigne le **coût d'achat réel** et le **coût d'achat de calcul**, et la plateforme génère automatiquement le **prix de vente** et l'**ancien prix** (prix barré marketing). Le vendeur peut désactiver le calcul auto pour revenir en mode manuel. L'admin configure les paramètres globaux (marges, multiplicateurs, marges parallèles).

---

## Formule de calcul

```text
Entrées vendeur :
  - cost_real      : coût d'achat réel (pour stats marges)
  - cost_calc      : coût d'achat pour calcul (≥ cost_real)

Paramètres configurables (défauts) :
  - margin_pct     : 15 (%)
  - multiplier     : 3

Prix de vente :
  sale_price = cost_calc + (cost_calc × margin_pct / 100) × multiplier
  sale_price = arrondi stratégique (terminaison .99 ou .49)

Ancien prix (marketing) selon sale_price :
  < 10$   → sale_price × 3
  < 20$   → sale_price × 2.5
  < 50$   → sale_price × 2
  < 100$  → sale_price × 2
  < 150$  → sale_price × 1.8
  ≥ 150$  → sale_price × 1.5
  + terminaison stratégique .99

Marge parallèle vendeur (optionnelle, activable) :
  sale_price < 50$  → max +0.50$
  sale_price ≥ 100$ → max +1.00$
```

---

## Changements techniques

### 1. Migration DB — nouvelles colonnes `products` + settings

- **`products`** : ajouter `cost_real`, `cost_calc`, `auto_pricing_enabled` (bool, default true), `vendor_extra_margin` (numeric)
- **`platform_settings`** : insérer clé `pricing_defaults` avec valeurs `{ margin_pct: 15, multiplier: 3, max_extra_margin_under_50: 0.50, max_extra_margin_over_100: 1.00 }`
- **`vendor_pricing_overrides`** (nouvelle table optionnelle) : `store_id`, `max_multiplier`, `max_extra_margin` — permet à l'admin de limiter un vendeur spécifique

### 2. Frontend — Module de pricing dans `VendorProductManager.tsx`

- Ajouter les champs dans `EMPTY_FORM` : `cost_real`, `cost_calc`, `auto_pricing_enabled`, `vendor_extra_margin`
- Nouveau composant `<PricingCalculator>` affiché au-dessus des champs Prix/Ancien prix :
  - Inputs : Coût d'achat réel, Coût d'achat calcul, % marge (défaut 15, lecture seule sauf admin), Multiplicateur (défaut 3, lecture seule sauf admin)
  - Switch "Calcul automatique" (on/off)
  - Quand activé : les champs Prix et Ancien prix deviennent **lecture seule** et se remplissent automatiquement
  - Quand désactivé : le vendeur saisit manuellement comme aujourd'hui
  - Input optionnel "Marge vendeur" avec limite affichée
  - Aperçu en temps réel : prix calculé, ancien prix, marge brute (cost_real vs sale_price)

### 3. Frontend — Admin Settings (pricing global)

- Nouvelle section dans `AdminSettingsPage.tsx` : "Tarification"
  - Champs : margin_pct, multiplier, seuils marge parallèle
  - Sauvegardé dans `platform_settings` clé `pricing_defaults`

### 4. Logique de calcul — Utilitaire partagé

- Fichier `frontend/src/lib/pricing-utils.ts` :
  - `calculateSalePrice(costCalc, marginPct, multiplier, vendorExtra?)` → prix arrondi stratégique
  - `calculateOldPrice(salePrice)` → ancien prix selon tranches
  - `strategicRound(price)` → arrondi à .99 ou .49
  - `getMaxExtraMargin(salePrice, settings)` → limite marge vendeur

### 5. Payload produit

- Le `save` dans `VendorProductManager` inclura `cost_real`, `cost_calc`, `auto_pricing_enabled`, `vendor_extra_margin` dans le payload vers Supabase

---

## Ce qui ne change PAS

- L'affichage côté client (ProductCard, ProductDetail) reste identique : `price` et `original_price`
- Les commandes/panier utilisent toujours `price`
- Le vendeur peut toujours désactiver le calcul auto et saisir ses prix manuellement

---

## Rappel post-implémentation

Après ce module : implémenter le système de **pricing par vendeur avec overrides admin** (table `vendor_pricing_overrides`).

