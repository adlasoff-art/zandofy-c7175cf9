

## Plan : Fonctionnalité Fournisseurs payante (toggle admin) + isolation des données

### Contexte actuel

- Les commandes sont liées à une boutique (`store_id`), donc un vendeur ne voit **que ses propres commandes** — pas celles d'autres boutiques.
- Le `SupplierPopover` lit le `supplier_id` du produit, puis charge le fournisseur. Puisque la RLS limite les fournisseurs au `vendor_id = auth.uid()`, un vendeur ne peut déjà pas voir les fournisseurs d'un autre vendeur. **L'isolation est déjà en place.**
- L'admin gère les toggles par boutique dans `AdminVendorPricingPage.tsx` via `vendor_pricing_overrides`.

### Réponse à la question "commande multi-fournisseurs"

Une commande = une boutique = un vendeur. Si le panier contient des produits de 2 boutiques, le système crée 2 commandes séparées (une par `store_id`). Donc un vendeur ne voit jamais les produits/fournisseurs d'un autre vendeur dans "sa" commande. **Pas de split à implémenter.**

Au sein d'une même commande (même boutique), un vendeur peut avoir 2 produits liés à 2 fournisseurs différents. Le `SupplierPopover` est déjà affiché **par produit**, donc chaque icône montre le bon fournisseur. Aucun changement nécessaire ici.

---

### Changements à implémenter

#### 1. Migration SQL — Ajouter toggle `suppliers_enabled` sur `vendor_pricing_overrides`

```sql
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS suppliers_enabled BOOLEAN NOT NULL DEFAULT false;
```

#### 2. Admin — Toggle dans `AdminVendorPricingPage.tsx`

- Ajouter `suppliers_enabled` dans l'état `edits`, le `getEdit`, et le `handleSave`
- Ajouter un bloc Switch comme les autres toggles existants :
  - Label : **"Gestion des fournisseurs"**
  - Description : *"Fonctionnalité payante : permet au vendeur de gérer ses fournisseurs et de les lier à ses produits."*

#### 3. Vendor Dashboard — Conditionner l'onglet "Fournisseurs"

- Dans `VendorDashboardPage.tsx`, charger `suppliers_enabled` depuis `vendor_pricing_overrides` pour le store courant
- Conditionner l'affichage du tab "Fournisseurs" dans le sidebar : `...(suppliersEnabled ? [{ key: "suppliers", ... }] : [])`

#### 4. Product Form — Conditionner le champ fournisseur

- Dans `VendorProductManager.tsx`, passer un prop `suppliersEnabled` et masquer le select fournisseur quand `false`

#### 5. Order View — Conditionner l'icône fournisseur

- Dans `VendorOrderManager.tsx`, passer `suppliersEnabled` et ne rendre le `<SupplierPopover>` que si activé

---

### SQL à exécuter manuellement (Supabase.com)

```sql
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS suppliers_enabled BOOLEAN NOT NULL DEFAULT false;
```

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `AdminVendorPricingPage.tsx` | Nouveau toggle "Gestion des fournisseurs" |
| `VendorDashboardPage.tsx` | Charger `suppliers_enabled`, conditionner tab + passer prop |
| `VendorProductManager.tsx` | Cacher champ fournisseur si non activé |
| `VendorOrderManager.tsx` | Cacher icône fournisseur si non activé |
| Migration SQL | `suppliers_enabled` sur `vendor_pricing_overrides` |

