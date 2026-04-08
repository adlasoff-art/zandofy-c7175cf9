

# Diagnostic : Sélecteur de produit fournisseur

## Constat

Le code dans `VendorProductManager.tsx` (lignes 728-751) contient **déjà** un sélecteur "📦 Produit du fournisseur" qui :
- Se charge quand un fournisseur est sélectionné
- Affiche les produits du fournisseur dans un dropdown
- Sauvegarde le `supplier_product_id` dans la table `products`
- Affiche une preview avec image et label du produit sélectionné

## Hypothèse du bug

Le sélecteur est conditionné par `supplierProductOptions.length > 0` (ligne 729). Si les produits fournisseur ne sont pas correctement enregistrés dans la table `supplier_products`, le dropdown ne s'affiche jamais — ce qui donne l'impression que la fonctionnalité n'existe pas.

## Actions prévues

### 1. Améliorer la visibilité du sélecteur produit
- Toujours afficher la section "📦 Produit du fournisseur" quand un fournisseur est sélectionné, même si aucun produit n'existe
- Si aucun produit : afficher un message "Ce fournisseur n'a aucun produit enregistré — ajoutez-en depuis l'onglet Fournisseurs"
- Ajouter un indicateur de chargement pendant le fetch des produits

### 2. Améliorer le rendu du sélecteur
- Remplacer le `<select>` basique par un sélecteur enrichi montrant pour chaque produit : **image miniature + label + lien**
- Afficher les produits sous forme de cartes cliquables au lieu d'un simple dropdown, pour une meilleure expérience visuelle

### 3. Vérifier la sauvegarde des produits fournisseur
- Auditer que les produits ajoutés dans `VendorSuppliersTab` sont correctement persistés dans `supplier_products` avec le bon `supplier_id`

## Fichiers impactés

| Fichier | Modification |
|---|---|
| `frontend/src/components/VendorProductManager.tsx` | Améliorer le sélecteur de produit fournisseur : toujours visible, cartes visuelles, message si vide, loader |

## Résumé technique

Pas de migration SQL nécessaire — les tables et colonnes (`supplier_products`, `products.supplier_product_id`) existent déjà. C'est une amélioration purement UI/UX du formulaire produit.

