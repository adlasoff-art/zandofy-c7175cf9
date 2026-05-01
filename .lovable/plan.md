# Plan — Panier (addition) + Bloc expédition transitaire

## Sujet 1 — Panier : addition + feedback explicite

**Comportement final retenu**
- Ajout depuis la page produit d'une variante (product_id + color + size) **déjà présente** au panier → on **additionne** : `nouvelleQté = ancienneQté + qtéSaisie`.
- Exemple : 1 dans le panier + 150 saisis = **151**.
- L'utilisateur peut ensuite ajuster (±, supprimer) depuis le drawer.

**Pourquoi ce choix (verrouillé en mémoire)**
- Standard e-commerce, prévisible.
- Évite la perte accidentelle d'une quantité déjà choisie.
- Les ajustements à la baisse restent triviaux depuis le drawer.

**Changements code**
- `frontend/src/contexts/CartContext.tsx` : la logique additive existe déjà. On améliore uniquement le **toast** :
  - Si la ligne existait : `"Panier mis à jour — {newQty} pièces au total"`.
  - Sinon : `"Ajouté au panier — {qty} pièce(s)"`.
  - Toast cliquable qui ouvre le drawer (action "Voir le panier").
- `frontend/src/pages/ProductPage.tsx` : après `addItem`, déclencher l'ouverture du drawer (déjà en place, on vérifie) et **scroll + flash** sur la ligne mise à jour.
- `frontend/src/components/cart/CartDrawer.tsx` (ou équivalent) : prop `highlightItemId` + classe Tailwind `animate-pulse` 1.2s sur la ligne ciblée.

**Aucun changement DB. Aucun risque RLS.**

## Sujet 2 — Bloc expédition transitaire (vendeur/admin only)

**Objectif métier**
Quand un vendeur (ou admin) ouvre une commande dont le transitaire est sélectionné, il peut copier en **un clic** :
1. Le **bloc "infos à imprimer sur le colis"** (nom client, téléphone, ville, pays, ref commande).
2. L'**adresse de l'entrepôt du transitaire** (Chine / Turquie / etc.).

Le **client ne voit jamais** l'adresse entrepôt.

**Modèle de données**

Nouvelle table `forwarder_shipping_templates` :

```text
id              uuid PK
forwarder_id    uuid FK -> forwarders(id) ON DELETE CASCADE
label           text         (ex: "Entrepôt Guangzhou", "Entrepôt Istanbul")
warehouse_address text       (adresse complète multi-lignes)
package_info_template text   (gabarit avec placeholders)
is_default      boolean default false
sort_order      int default 0
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

**Placeholders supportés** (validés) :
`{{customer_name}}`, `{{phone}}`, `{{city}}`, `{{country}}`, `{{order_ref}}`

Gabarit par défaut proposé :
```text
{{customer_name}}
Tel: {{phone}}
{{city}}, {{country}}
Ref: {{order_ref}}
```

**RLS (verrouillage strict)**
- `SELECT` : `authenticated` ET (`has_role(auth.uid(),'admin')` OU `has_role(auth.uid(),'vendor')`).
- `INSERT/UPDATE/DELETE` : `has_role(auth.uid(),'admin')` uniquement.
- Aucune policy `anon`. Aucun client final n'a accès.

**Frontend — Admin (gestion)**
- `frontend/src/components/admin/ForwarderFormDialog.tsx` : nouvel onglet "Templates d'expédition" listant/CRUDant les `forwarder_shipping_templates` du transitaire (label, warehouse_address en textarea, package_info_template en textarea avec aide placeholders, is_default toggle).

**Frontend — Vendeur/Admin (vue commande)**
- Nouveau composant `frontend/src/components/orders/ForwarderShippingCopyBlock.tsx` :
  - Props : `orderId`, `forwarderId`, `customer` (name, phone, city, country), `orderRef`.
  - Charge les templates du transitaire.
  - Si plusieurs templates → `<Select>` (pré-sélection `is_default`).
  - Affiche 2 cartes côte à côte :
    - **"Infos à coller sur le colis"** : texte résolu (placeholders remplacés) + bouton "Copier".
    - **"Adresse entrepôt transitaire"** : `warehouse_address` brut + bouton "Copier".
  - Bouton supplémentaire "Tout copier" (concatène les deux blocs séparés par une ligne).
  - Toast `sonner` "Copié dans le presse-papier".
- Monté **uniquement** dans :
  - `frontend/src/pages/vendor/VendorOrderDetail.tsx` (ou route équivalente vendeur).
  - `frontend/src/pages/admin/AdminOrderDetail.tsx` (ou équivalent admin).
- **JAMAIS** dans `CustomerOrderTracker`, `CheckoutPage`, `ForwarderSelector` (côté client).

**i18n**
Ajouts dans `I18nContext.tsx` (FR/EN/...) :
`shipping.copy.package_info`, `shipping.copy.warehouse_address`, `shipping.copy.copy_button`, `shipping.copy.copy_all`, `shipping.copy.copied_toast`, `shipping.copy.select_template`.

## Schéma de l'écran vendeur (Sujet 2)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Commande #ZF-2026-00123        [statut: en préparation]        │
├─────────────────────────────────────────────────────────────────┤
│  Client : Aïcha M. — +243 ... — Kinshasa, RDC                   │
│  Transitaire : ChinaExpress  ▼ [Entrepôt Guangzhou ▾]           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌──────────────────────────┐     │
│  │ 📋 Infos à coller        │  │ 🏬 Adresse entrepôt      │     │
│  │    sur le colis          │  │    (vendeur uniquement)  │     │
│  │                          │  │                          │     │
│  │ Aïcha M.                 │  │ ChinaExpress Warehouse   │     │
│  │ Tel: +243 ...            │  │ Building 7, Baiyun Dist. │     │
│  │ Kinshasa, RDC            │  │ Guangzhou 510000, China  │     │
│  │ Ref: ZF-2026-00123       │  │ Contact: +86 ...         │     │
│  │                          │  │                          │     │
│  │       [ Copier ]         │  │       [ Copier ]         │     │
│  └──────────────────────────┘  └──────────────────────────┘     │
│                      [ Tout copier ]                            │
└─────────────────────────────────────────────────────────────────┘
```

Côté client (`CustomerOrderTracker`, checkout) → **rien de tout ceci n'apparaît**. Le client voit uniquement : nom du transitaire, tarif, délai estimé.

## Ordre d'exécution

1. Migration SQL : table `forwarder_shipping_templates` + RLS + index `(forwarder_id, sort_order)`.
2. Composant `ForwarderShippingCopyBlock` + intégration dans pages vendeur/admin.
3. Onglet templates dans `ForwarderFormDialog`.
4. Toast amélioré dans `CartContext` + highlight dans `CartDrawer`.
5. Mémoire : note `mem://features/forwarders-and-logistics-system` mise à jour ("templates d'expédition vendeur/admin only, jamais client").

## Hors scope (à confirmer plus tard si besoin)
- Génération PDF étiquette (déjà couvert par "Thermal Shipping Labels").
- Multi-langue du gabarit (1 seul texte par template pour l'instant).
- Upload logo transitaire dans le bloc copié.

Sur approbation, je passe en mode build et applique tout en une seule itération.
