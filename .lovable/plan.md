

# Plan : Image produit fournisseur + Plateformes en upload/combobox + Affichage dans commandes

## Résumé

Ajouter une image produit au formulaire fournisseur, convertir le champ plateforme en combobox dynamique alimenté par les plateformes admin, remplacer l'URL logo par un upload dans l'admin des plateformes, et afficher l'image fournisseur dans le sélecteur produit et les commandes.

---

## 1. Migration SQL — Ajouter `product_image_url` à `suppliers` + `platform_id`

- Ajouter `product_image_url text` à la table `suppliers`
- Ajouter `platform_id uuid REFERENCES supplier_platforms(id)` à la table `suppliers` (nullable, pour remplacer le champ texte `platform_name` à terme)
- Créer un bucket de stockage `supplier-images` (public) avec policies pour upload/read

## 2. Admin — Plateformes fournisseurs : upload logo + édition

**Fichier** : `AdminSupplierPlatformsPage.tsx`

- Remplacer le champ `Input` "URL du logo" par le composant `MediaUploader` existant pour uploader le logo dans le bucket `product-media` (ou un bucket dédié)
- Ajouter un mode **édition inline** : cliquer sur une plateforme permet de modifier son nom et son logo (bouton crayon → formulaire inline ou modal)
- Permettre le re-upload du logo pour les plateformes existantes

## 3. Formulaire fournisseur (vendeur) — Image produit + plateforme en combobox

**Fichier** : `VendorSuppliersTab.tsx`

- Ajouter le composant `MediaUploader` au formulaire (modal) pour uploader l'image produit du fournisseur dans le bucket `supplier-images`
- Remplacer le champ texte "Plateforme" par un **combobox/select** alimenté dynamiquement par la table `supplier_platforms` (fetch des plateformes actives au chargement)
- Stocker `platform_id` dans `suppliers` au lieu de `platform_name` en texte libre
- Garder la rétro-compatibilité : afficher `platform_name` si `platform_id` est null (données existantes)

## 4. Formulaire produit — Afficher l'image fournisseur dans le sélecteur

**Fichier** : `VendorProductManager.tsx`

- Modifier l'interface `Supplier` pour inclure `product_image_url`
- Modifier le fetch des suppliers pour inclure `product_image_url`
- Remplacer le `<select>` fournisseur par un **combobox custom** avec recherche qui affiche pour chaque option :
  - À gauche : la miniature de l'image produit (ou une icône par défaut)
  - Au centre : le nom de l'agent + la plateforme
- Cela permet au vendeur de visuellement matcher le bon fournisseur au bon produit

## 5. Commandes — Icône fournisseur visible avant expansion

**Fichier** : `VendorOrderManager.tsx`

- Dans la **ligne résumée** (non dépliée) de chaque commande, si `suppliersEnabled`, ajouter une icône 🚛 cliquable à côté du numéro de commande
- Au clic, afficher un **popover/modal** listant pour chaque produit de la commande :
  - Image produit du fournisseur (miniature)
  - Nom de l'agent / plateforme
  - Informations clés du fournisseur

**Fichier** : `SupplierPopover.tsx`

- Modifier le fetch pour inclure `product_image_url`
- Afficher l'image en miniature en haut du popover
- Créer un nouveau composant `OrderSuppliersPopover` qui prend la liste des items de la commande et affiche les fournisseurs groupés par produit

## 6. Affichage dans la liste fournisseurs (vendeur)

**Fichier** : `VendorSuppliersTab.tsx`

- Dans la liste des fournisseurs, afficher la miniature de l'image produit à la place de l'icône `User` générique
- Afficher le nom de la plateforme résolu depuis `platform_id` (ou le champ texte legacy)

---

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| Migration SQL | `product_image_url` + `platform_id` sur `suppliers`, bucket `supplier-images` |
| `AdminSupplierPlatformsPage.tsx` | Upload logo + mode édition |
| `VendorSuppliersTab.tsx` | Upload image produit + plateforme en combobox |
| `VendorProductManager.tsx` | Combobox fournisseur avec miniature image |
| `VendorOrderManager.tsx` | Icône fournisseur en vue résumée commande |
| `SupplierPopover.tsx` | Afficher image produit dans le popover |

---

## Section technique

- Le bucket `supplier-images` sera public avec policy INSERT pour authenticated users et SELECT public
- Le `MediaUploader` existant sera réutilisé tel quel (il gère déjà compression + upload vers Supabase Storage)
- Le combobox plateforme dans le formulaire fournisseur fera un fetch `supplier_platforms` WHERE `is_active = true`
- La migration conserve `platform_name` pour la rétro-compatibilité mais le code priorisera `platform_id` → nom résolu

