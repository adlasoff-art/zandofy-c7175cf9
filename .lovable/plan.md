

# Améliorations des étiquettes d'expédition

## Résumé des changements demandés

1. **FROM** : Afficher le nom de la boutique en gras (même taille que le nom du destinataire) + origine du produit (pays d'origine)
2. **SHIP TO** : Ajouter le champ email du client
3. **TRACK** : Toujours afficher le tracking number (du fournisseur) dans la grille de détails
4. **Logo carrier** : Remplacer le texte "VERYSPEED" par un logo uploadable par l'admin via `platform_settings` (clé `shipping_label_config`)
5. **QR code moderne** : Utiliser le style arrondi (dots) au lieu du style carré classique
6. **Code-barres** : Ajouter un vrai code-barres (Code128) en bas de l'étiquette via la lib `react-barcode`

## Détail technique

### 1. Edge Function `generate-shipping-labels`

**Modifications** :
- Ajouter `shipping_email` à la requête SELECT sur `orders`
- Ajouter `origin_country` à la requête via les `order_items` → `products` (récupérer l'`origin_country` du premier produit de la commande)
- Ajouter `recipientEmail` et `originCountry` aux données retournées
- Récupérer le logo carrier depuis `platform_settings` clé `shipping_label_config` → `carrier_logo_url`

### 2. Admin : Upload du logo carrier

Ajouter une section dans la page admin existante (branding ou settings) permettant d'uploader un logo pour les étiquettes d'expédition. Le logo sera stocké dans le bucket `product-media` (existant) et l'URL sauvegardée dans `platform_settings` avec la clé `shipping_label_config`.

Pas de migration SQL nécessaire — on utilise `platform_settings` (upsert sur la clé).

### 3. Composant `ShippingLabelPreview.tsx`

**Modifications** :
- Ajouter `recipientEmail`, `originCountry`, `carrierLogoUrl` à l'interface `LabelData`
- **FROM** : Afficher `storeName` en gras taille `text-sm font-black` (même style que recipientName), puis l'origine en dessous
- **SHIP TO** : Ajouter `✉ recipientEmail` sous le téléphone
- **TRACK** : Afficher systématiquement (même vide avec "—")
- **Logo** : Remplacer le texte "VERYSPEED / LOGISTICS" par une balise `<img>` si `carrierLogoUrl` est fourni, sinon fallback texte
- **QR code** : Passer les options de style arrondi via les props de `QRCodeCanvas` (si qrcode.react v4+ le supporte, sinon utiliser `qrcode-react` avec `imageSettings`)
- **Code-barres** : Installer `react-barcode` et ajouter un composant `<Barcode>` en bas avec la référence commande, format CODE128
- Même ajustements dans le HTML généré pour `handlePrint`

### 4. Dépendance

- Installer `react-barcode` pour le code-barres en bas de l'étiquette

### 5. Mockup PDF v3

Régénérer un PDF mis à jour avec tous les changements pour validation visuelle.

## Fichiers modifiés/créés

| Fichier | Action |
|---|---|
| `frontend/supabase/functions/generate-shipping-labels/index.ts` | Ajouter email, origin_country, carrier_logo_url |
| `frontend/src/components/shipping/ShippingLabelPreview.tsx` | Refonte FROM, email, logo image, barcode, QR arrondi |
| `frontend/src/pages/admin/AdminEmailTemplatesPage.tsx` ou nouveau composant admin | Section upload logo carrier pour étiquettes |
| `package.json` | Ajouter `react-barcode` |
| `/mnt/documents/shipping_label_mockup_v3.pdf` | Nouveau mockup |

## Sécurité

Aucun changement de schéma DB. Le logo est stocké via `platform_settings` (table déjà protégée par RLS admin). L'Edge Function conserve toutes ses vérifications JWT et rôles existantes.

