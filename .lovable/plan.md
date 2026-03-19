

# Boutiques plateforme vs vendeurs indépendants

## Concept

Deux types de boutiques coexistent :
- **Boutiques plateforme** : appartiennent à Zandofy, pas de commission déduite (100% du CA revient à la plateforme), les vendeurs sont "salariés". Le champ `vendor_extra_margin` sert de bonus/gratification.
- **Boutiques indépendantes** : vendeurs externes, commission déduite (par défaut 10%, configurable par boutique). Le wallet reçoit `subtotal × (1 - commission_rate)`.

## Modifications

### 1. Migration SQL
- Ajouter `is_platform_owned BOOLEAN DEFAULT false` à la table `stores`
- Ajouter `commission_rate NUMERIC(5,2) DEFAULT 10.00` à la table `vendor_pricing_overrides` (commission en %, configurable par boutique)

### 2. Trigger `credit_vendor_wallet_on_delivery` (modification)
Adapter la logique existante :
- Si `stores.is_platform_owned = true` → **pas de crédit wallet** (l'argent reste à la plateforme)
- Si `is_platform_owned = false` → créditer le wallet avec `subtotal × (1 - commission_rate/100)`, en utilisant le `commission_rate` de `vendor_pricing_overrides` si défini, sinon le défaut global (10%)

### 3. Page admin `/admin/vendor-pricing` (modification)
- Ajouter un **toggle "Boutique plateforme"** par boutique (badge visuel distinct)
- Ajouter un champ **"Commission (%)"** éditable par boutique (uniquement affiché pour les indépendants)
- Afficher un badge "Plateforme" ou "Indépendant" dans la liste

### 4. Admin Sidebar
- Ajouter l'entrée "Comptabilité vendeurs" (`/admin/vendor-accounting`) dans la sidebar

### 5. Page `/admin/vendor-accounting` (nouvelle)
Tableau récapitulatif par boutique avec filtre période + recherche :
- Colonnes : Boutique, Type (Plateforme/Indépendant), CA livré, Coût achat, Marge vendeur (bonus), Commission plateforme, Net dû vendeur
- Pour les boutiques **plateforme** : commission = 0%, net dû = uniquement la somme des `vendor_extra_margin` (bonus)
- Pour les boutiques **indépendantes** : net dû = CA − commission (déjà dans le wallet)
- Détail par produit en expandable
- Graphique top 10 par CA

### 6. Paramètres globaux (`AdminSettingsPage`)
- Ajouter un champ "Commission plateforme par défaut (%)" dans les paramètres globaux (clé `platform_commission_default` dans `platform_settings`)

## Résumé technique

| Fichier | Action |
|---------|--------|
| Migration SQL | `ALTER TABLE stores ADD is_platform_owned`, `ALTER TABLE vendor_pricing_overrides ADD commission_rate` |
| Fonction `credit_vendor_wallet_on_delivery` | Recréer pour tenir compte du type de boutique |
| `AdminVendorPricingPage.tsx` | Ajouter toggle plateforme + champ commission |
| `AdminVendorAccountingPage.tsx` | Nouvelle page comptabilité |
| `AdminSidebar.tsx` | Ajouter lien comptabilité |
| `App.tsx` | Ajouter route `/admin/vendor-accounting` |
| `AdminSettingsPage.tsx` | Ajouter commission par défaut |

