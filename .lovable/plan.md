

# Système multi-produits par fournisseur

## Contexte actuel

Aujourd'hui, un fournisseur a **une seule image produit** (`product_image_url`) et **une seule URL boutique** (`store_url`). Quand un vendeur crée un produit dans son catalogue, il choisit un fournisseur, mais ne peut pas préciser **quel produit** de ce fournisseur correspond.

## Ce qui va changer

### 1. Nouvelle table `supplier_products`

Chaque fournisseur pourra avoir **plusieurs produits**, chacun avec :
- Un **nom/label** (ex: "Robe rouge modèle X")
- Un **lien produit** (URL directe vers le produit chez le fournisseur)
- Une **image produit** (uploadée via le même système MediaUploader)

```text
supplier_products
├── id (uuid, PK)
├── supplier_id (FK → suppliers)
├── label (text, nom du produit fournisseur)
├── product_url (text, lien direct vers le produit)
├── image_url (text, image du produit)
├── position (int, ordre d'affichage)
└── created_at (timestamptz)
```

La colonne `product_image_url` existante sur `suppliers` sera conservée comme image principale/avatar du fournisseur.

### 2. Nouveau champ `supplier_product_id` sur `products`

Quand un vendeur crée un produit catalogue, en plus de choisir le fournisseur, il pourra **sélectionner le produit fournisseur** correspondant. Cela crée un lien direct produit Zandofy ↔ produit fournisseur.

```text
products (existant)
├── supplier_id (FK → suppliers) ← déjà existant
└── supplier_product_id (FK → supplier_products) ← NOUVEAU
```

### 3. Formulaire fournisseurs (`VendorSuppliersTab`)

- L'URL boutique reste en haut (une seule par fournisseur)
- **Nouvelle section** "Produits du fournisseur" avec un bouton **[+ Ajouter un produit]**
- Chaque produit = un bloc avec : label, URL produit, image (MediaUploader)
- Ajout illimité de produits
- Suppression individuelle possible
- Les produits existants sont chargés/sauvegardés via `supplier_products`

### 4. Formulaire produit catalogue (`VendorProductManager`)

- Le sélecteur de fournisseur reste identique
- **Nouveau** : quand un fournisseur est sélectionné, un second sélecteur apparaît listant ses produits (avec miniature)
- Le vendeur choisit le produit fournisseur correspondant → stocké dans `supplier_product_id`

### 5. Popover fournisseur dans les commandes (`SupplierPopover`)

- **Icône changée** : `Store` (boutique) au lieu de `Truck` (camion)
- Le popover affiche maintenant **par produit de la commande** :
  - L'image du produit Zandofy + l'image du produit fournisseur (côte à côte)
  - Le lien **Boutique fournisseur** (store_url du supplier)
  - Le lien **Produit fournisseur** (product_url du supplier_product) ← NOUVEAU
  - Le nom de l'agent et la plateforme
- Si plusieurs produits dans la commande, chacun affiche son propre fournisseur/produit

## Étapes d'implémentation

1. **Migration SQL** : créer `supplier_products`, ajouter `supplier_product_id` à `products` avec FK, RLS policies
2. **`VendorSuppliersTab`** : refondre le formulaire pour gérer N produits par fournisseur (ajout/suppression dynamique)
3. **`VendorProductManager`** : ajouter le sélecteur de produit fournisseur (dépendant du fournisseur choisi)
4. **`SupplierPopover`** : charger `supplier_products` au lieu de `product_image_url`, afficher le lien produit, changer l'icône en `Store`

## Section technique

- RLS sur `supplier_products` : lecture/écriture limitée au `vendor_id` du supplier parent
- Les données existantes (`product_image_url` sur suppliers) restent compatibles — le popover les utilise en fallback si aucun `supplier_product` n'est lié
- Le bucket `supplier-images` existant est réutilisé pour les images des nouveaux produits fournisseur

