

# Plan : Sélection partielle du panier, correction duplicata, et refonte adresses avec Commune/Quartier

## Contexte

Trois fonctionnalités demandées :
1. **Checkout sélectif** : pouvoir choisir quels articles du panier commander, les autres restent pour plus tard
2. **Correction duplicata panier** : ajouter le même produit+couleur+taille doit incrémenter la quantité, pas créer une ligne en double (le code JS le fait mais la DB n'a pas de contrainte UNIQUE — un insert concurrent ou un bug de state peut créer des doublons)
3. **Refonte adresses** : ajouter les champs Commune et Quartier (combobox admin-gérés), combobox de sélection d'adresse au checkout, placeholder adapté

---

## Migration SQL requise

```sql
-- 1. Contrainte unique sur cart_items pour empêcher les doublons
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_variant
  ON public.cart_items (user_id, product_id, COALESCE(color, ''), COALESCE(size, ''));

-- 2. Champs Commune et Quartier sur saved_addresses
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS commune text;
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS quartier text;

-- 3. Champs Commune et Quartier sur orders (shipping)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_commune text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_quartier text;

-- 4. Table communes (admin-gérée)
CREATE TABLE IF NOT EXISTS public.communes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  country_code text NOT NULL DEFAULT 'CD',
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(city, name, country_code)
);
ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read communes" ON public.communes FOR SELECT USING (true);
CREATE POLICY "Admins manage communes" ON public.communes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Table quartiers (admin-gérée, liée à commune)
CREATE TABLE IF NOT EXISTS public.quartiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  is_restricted boolean DEFAULT false,
  restriction_reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(commune_id, name)
);
ALTER TABLE public.quartiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read quartiers" ON public.quartiers FOR SELECT USING (true);
CREATE POLICY "Admins manage quartiers" ON public.quartiers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Colonne selected sur cart_items pour le checkout sélectif
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS selected boolean NOT NULL DEFAULT true;
```

---

## Lot 1 : Checkout sélectif (panier partiel)

### Principe
- Chaque `cart_item` a un champ `selected` (boolean, default true)
- Le CartDrawer affiche une checkbox par article
- Le bouton "Commander" ne prend que les articles sélectionnés
- Seuls les articles sélectionnés sont envoyés au checkout ; les autres restent dans le panier

### Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `CartContext.tsx` | Ajouter `selected` à `CartItem`, exposer `toggleSelected(id)`, `selectAll()`, `deselectAll()`. Adapter `itemCount` et `subtotal` pour ne compter que les sélectionnés. Ajouter `selectedItems` |
| `CartDrawer.tsx` | Ajouter checkbox par article, boutons "Tout sélectionner / Tout désélectionner", afficher sous-total des sélectionnés uniquement |
| `CheckoutPage.tsx` | Remplacer `items` par `selectedItems` (items filtrés `selected === true`). Après commande réussie, ne supprimer que les articles commandés (pas `clearCart()`) |

---

## Lot 2 : Correction duplicata panier

### Problème
Le code JS (`CartContext.tsx` lignes 100-103) cherche le doublon côté state, mais si le state n'est pas encore rafraîchi ou en cas de clic rapide, l'insert DB peut créer un doublon car il n'y a pas de contrainte UNIQUE.

### Solution
1. **DB** : Ajouter un index unique `(user_id, product_id, COALESCE(color, ''), COALESCE(size, ''))` sur `cart_items`
2. **Code** : Modifier `addItem` pour utiliser un upsert (`ON CONFLICT`) côté DB au lieu de vérifier uniquement le state local. Utiliser l'approche : tenter l'insert, si conflit → update quantity += new quantity

### Fichier impacté
- `CartContext.tsx` : refactorer `addItem` avec upsert DB + refresh

---

## Lot 3 : Refonte adresses — Commune/Quartier + Combobox

### 3a. Nouveaux champs DB
- `saved_addresses` : +`commune`, +`quartier`
- `orders` : +`shipping_commune`, +`shipping_quartier`
- Tables `communes` et `quartiers` gérées par l'admin

### 3b. Formulaire Checkout (`CheckoutPage.tsx`)

Refonte du formulaire d'expédition :

```text
┌─────────────────────────────────────────┐
│ [Combobox: Sélectionner une adresse ▼]  │  ← liste des saved_addresses
├──────────────┬──────────────────────────┤
│ Prénom *     │ Nom *                    │
├──────────────┼──────────────────────────┤
│ Email        │ Téléphone *              │
├──────────────┴──────────────────────────┤
│ Adresse * (placeholder: N° parcelle,   │
│            avenue/rue)                  │
├──────────────┬──────────────┬───────────┤
│ Quartier *   │ Commune *    │ Ville *   │
│ (combobox)   │ (combobox)   │           │
├──────────────┼──────────────┼───────────┤
│ Pays *       │ Code postal  │           │
└──────────────┴──────────────┴───────────┘
```

- Le combobox adresse en haut : quand le client sélectionne une adresse, tous les champs se remplissent automatiquement
- Quartier et Commune : combobox alimentés par les tables `quartiers` et `communes`
- Commune filtrée par ville sélectionnée ; Quartier filtré par commune sélectionnée
- Code postal non obligatoire
- L'adresse label peut être saisie librement (ex: "Bureau 1", "Domicile 2")

### 3c. Formulaire Dashboard Adresses (`DashboardPage.tsx` — `AddressesTab`)
- Mêmes ajouts : champs commune et quartier (combobox)
- Le label d'adresse devient un champ texte libre au lieu du select "Domicile/Bureau/Autre"

### 3d. `ShippingInfo` type
Ajouter `commune` et `quartier` au type, et les inclure dans l'insertion order

### Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `CheckoutPage.tsx` | Ajouter `commune`/`quartier` à `ShippingInfo`, combobox adresse en haut, combobox commune/quartier dans le formulaire, insérer dans `orders`, sauvegarder dans `saved_addresses` |
| `DashboardPage.tsx` | Ajouter commune/quartier au formulaire d'adresses, label texte libre |
| Migration SQL | Tables `communes`, `quartiers`, colonnes sur `saved_addresses` et `orders` |

---

## Ordre d'implémentation

1. Migration SQL (contrainte unique cart, tables communes/quartiers, colonnes)
2. Lot 2 — Correction duplicata cart (petit, rapide)
3. Lot 1 — Checkout sélectif (CartContext, CartDrawer, CheckoutPage)
4. Lot 3 — Refonte adresses (communes/quartiers combobox, formulaires checkout + dashboard)

---

## Section technique

- La contrainte unique `cart_items` utilise `COALESCE` car `color` et `size` sont nullable — deux NULL ne sont pas considérés égaux par PostgreSQL sans COALESCE
- L'upsert dans `addItem` utilisera `.upsert()` de Supabase avec `onConflict` ou un RPC dédié
- Les tables `communes`/`quartiers` sont en lecture publique (SELECT) pour que tout utilisateur puisse les voir dans les combobox, mais seul l'admin peut les gérer (INSERT/UPDATE/DELETE)
- Le champ `is_restricted` sur `quartiers` remplace/complète la table `restricted_zones` pour un filtrage plus fin au checkout

