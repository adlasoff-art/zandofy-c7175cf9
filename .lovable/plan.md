

# Refonte des etiquettes d'expedition + Corrections

## Problemes identifies

1. **Design non professionnel** — Le label actuel affiche "ZANDOFY" en texte au lieu des infos du vendeur. Les textes sont en francais au lieu d'anglais. Le QR code utilise le style carre classique au lieu du style moderne arrondi.
2. **QR code → 404** — Le lien genere est `/tracking/${orderRef}` mais la route `/tracking/:ref` n'existe pas. La page `/tracking` attend une saisie manuelle.
3. **Pas de vue vendeur** — Le composant `VendorOrderManager.tsx` n'integre pas la selection multiple ni le bouton d'etiquettes.
4. **Migration SQL deja executee** — Le fichier existe. L'utilisateur veut un export telechargeable.

## Plan d'execution

### 1. Exporter le SQL en fichier telechargeable

Copier le contenu de la migration vers `/mnt/documents/shipping_labels_migration.sql` pour telechargement direct.

### 2. Ajouter la route `/tracking/:ref` dans App.tsx

Ajouter une route dynamique qui pre-remplit le champ de recherche de `TrackingPage` avec le parametre `ref` et lance automatiquement la recherche. Cela corrige le QR code qui renvoie actuellement un 404.

### 3. Refonte complete du composant `ShippingLabelPreview.tsx`

**Layout professionnel en anglais, 100x150mm :**

```text
┌──────────────────────────────────┐
│ ┌─────────┐     ┌─────────────┐ │
│ │VerySpeed │     │  QR CODE    │ │
│ │  LOGO    │     │  (moderne)  │ │
│ └─────────┘     └─────────────┘ │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ FROM:                            │
│ Store Name (vendeur)             │
│ City, Country                    │
│──────────────────────────────────│
│ SHIP TO:                         │
│ ██ Recipient Name ██  (gras)     │
│ 123 Avenue Liberte               │
│ Kinshasa, CD                     │
│ +243 xxx xxx xxx                 │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ ORDER:  ZDY-20260415-A001        │
│ TRACK:  TRK-789456               │
│ MODE:   Air · 2 item(s)         │
│ SHIP:   $12.50                   │
│ CARRIER: VerySpeed Logistics     │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│      ▇▇▇▇▇▇ BARCODE ▇▇▇▇▇▇     │
│      ZDY-20260415-A001           │
│      Scan to track your parcel   │
└──────────────────────────────────┘
```

**Changements cles :**
- Tout en **anglais** (FROM, SHIP TO, ORDER, TRACK, MODE, CARRIER, etc.)
- **Logo VerySpeed** (image noir/blanc) en haut a gauche au lieu du texte "ZANDOFY"
- **QR code moderne** avec `qrcode.react` options arrondies (cornerRadius, style dots)
- Infos **vendeur/boutique** comme expediteur (pas "Zandofy")
- Section **CARRIER: VerySpeed Logistics** dans le corps
- Bordures epaisses avec separateurs doubles (`━━━`) pour aspect professionnel
- Donnees **reelles** provenant de l'Edge Function (pas de donnees fictives)

### 4. Integrer les etiquettes dans VendorOrderManager

- Ajouter les checkboxes de selection multiple (meme pattern que AdminOrdersPage)
- Ajouter le bouton "Print Labels" conditionnel a `shipping_labels_enabled`
- Fetch du toggle via `vendor_pricing_overrides` au chargement du composant
- Inclure le composant `ShippingLabelPreview`

### 5. Regenerer le mockup PDF

Nouveau PDF `/mnt/documents/shipping_label_mockup_v2.pdf` avec :
- Logo VerySpeed converti en noir pur (threshold)
- QR code style moderne (dots arrondis)
- Layout professionnel anglais
- Bordures epaisses et sections bien delimitees

## Fichiers modifies/crees

| Fichier | Action |
|---|---|
| `/mnt/documents/shipping_labels_migration.sql` | Export SQL telechargeable |
| `/mnt/documents/shipping_label_mockup_v2.pdf` | Mockup v2 professionnel |
| `frontend/src/App.tsx` | Route `/tracking/:ref` ajoutee |
| `frontend/src/pages/TrackingPage.tsx` | Lecture du param URL pour auto-recherche |
| `frontend/src/components/shipping/ShippingLabelPreview.tsx` | Refonte complete du design |
| `frontend/src/components/vendor/VendorOrderManager.tsx` | Multi-selection + bouton etiquettes |

## Securite

Aucun changement — l'Edge Function existante gere deja la verification JWT, les roles, et le toggle `shipping_labels_enabled`. Les RLS sur `orders` et `products` restent intacts.

