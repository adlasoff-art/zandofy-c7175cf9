

# Simulation de design d'étiquette d'expédition + Implémentation complète

## Étape 1 — Génération d'un mockup PDF (100mm × 150mm)

Je vais générer un PDF de simulation avec Python (reportlab) au format exact 100×150mm, en noir et blanc pur, optimisé thermal printer.

### Layout de l'étiquette

```text
┌──────────────────────────────────┐  ← 100mm
│  [ZANDOFY ICON]    [VERYSPEED]  │
│  ████  grand Z      ██ logo VS  │
│  Powered by VerySpeed           │
│─────────────────────────────────│
│  DE (FROM):                     │
│  Boutique XYZ                   │
│  Kinshasa, RDC                  │
│─────────────────────────────────│
│  À (SHIP TO):                   │
│  Jean Dupont                    │
│  123 Avenue Liberté             │
│  Lubumbashi, Haut-Katanga       │
│  RDC  ·  +243 xxx xxx xxx      │
│─────────────────────────────────│
│  REF: ZDY-20260415-A001         │
│  SUIVI: TRK-789456              │
│  MODE: Aérien  ·  2 articles   │
│  EXPÉDITION: $12.50             │
│─────────────────────────────────│
│         ┌─────────┐            │
│         │ QR CODE │  ← B&W     │
│         │  (ref)  │  sans logo │
│         └─────────┘            │
│  ▇▇▇▇▇▇▇ BARCODE ▇▇▇▇▇▇▇▇▇  │
│         ZDY-20260415-A001       │
└──────────────────────────────────┘  ← 150mm
```

### Détails du mockup

- Les deux logos (Zandofy et VerySpeed) seront convertis en noir pur (threshold) pour compatibilité thermique
- QR code généré avec `qrcode` Python, style carré classique noir/blanc
- Police monospace pour lisibilité scanner
- Données fictives pour la démo

## Étape 2 — Implémentation dans la plateforme

### Migration SQL

```sql
ALTER TABLE vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS shipping_labels_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS can_ship_air boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_ship_sea boolean NOT NULL DEFAULT false;
```

Note : si `vendor_pricing_overrides` n'existe pas encore, je créerai la table avec les colonnes nécessaires + RLS.

### Edge Function `generate-shipping-labels`

- Accepte `orderIds[]`, vérifie JWT + rôle (admin/manager/vendeur propriétaire)
- Vérifie `shipping_labels_enabled` pour les vendeurs
- Génère HTML multi-étiquettes au format 100×150mm avec CSS `@media print`
- QR code encodant la référence commande

### Composants React

- `ShippingLabelPreview` — dialog d'aperçu + boutons Imprimer / PDF
- Checkboxes multi-sélection dans `AdminOrdersPage` et pages vendeur
- Checkboxes `can_ship_air` / `can_ship_sea` dans le formulaire produit

### Sécurité

- JWT obligatoire, vérification rôle server-side
- Vendeurs : accès uniquement leurs commandes + toggle activé
- CORS restrictif (même pattern que `generate-invoice`)

## Fichiers créés/modifiés

| Fichier | Action |
|---|---|
| `/mnt/documents/shipping_label_mockup.pdf` | Nouveau — simulation visuelle |
| Migration SQL | ALTER TABLE (2 colonnes produits + 1 toggle vendeur) |
| `frontend/supabase/functions/generate-shipping-labels/index.ts` | Nouveau |
| `frontend/src/components/shipping/ShippingLabelPreview.tsx` | Nouveau |
| `frontend/src/pages/admin/AdminOrdersPage.tsx` | Modifié — multi-sélection |
| `frontend/src/components/VendorProductManager.tsx` | Modifié — checkboxes expédition |

## Livraison

D'abord le mockup PDF pour validation visuelle, puis l'implémentation complète.

