

# Plan : Architecture Boutiques Locales vs Internationales

## Contexte

Le système actuel traite toutes les commandes via un flux unique international (Commande → Confirmation → Achat Chine → Shipping → Hub → Livraison). Il faut ajouter un flux parallèle pour les boutiques locales (stock physique à Kinshasa/RDC) avec livraison directe, sans toucher au flux existant.

---

## Phase 1 — Migrations SQL (base de données)

### 1.1 Enums et colonnes `stores`

Ajouter 3 colonnes à `stores` :
- `shop_type` : `text DEFAULT 'international'` (valeurs : `international`, `local`)
- `fulfillment_type` : `text DEFAULT 'zandofy_warehouse'` (valeurs : `zandofy_warehouse`, `vendor_warehouse`)
- `fleet_management` : `text DEFAULT 'platform'` (valeurs : `platform`, `own_fleet`)

### 1.2 Colonnes `orders`

Ajouter :
- `delivery_option` : `text` (valeurs possibles : `home_delivery`, `hub_pickup`, `road`, `rail` — étend les choix existants)
- `assigned_driver_id` : `uuid REFERENCES profiles(id)` (livreur local distinct du rider international)
- `assigned_driver_name` : `text`

Note : `delivery_choice` existe déjà pour le flux hub. `delivery_option` couvre le choix initial pour les boutiques locales.

### 1.3 Nouvelle table `local_shipping_rates`

```sql
CREATE TABLE public.local_shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL,
  city text NOT NULL DEFAULT 'Kinshasa',
  country text NOT NULL DEFAULT 'CD',
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  price_per_km numeric(10,2) DEFAULT 0,
  vendor_override_allowed boolean DEFAULT false,
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

RLS : lecture publique, écriture admin + vendeur (si `own_fleet` et `vendor_override_allowed`).

### 1.4 RLS supplémentaire

- Politique pour que les livreurs (`assigned_driver_id`) puissent lire l'adresse de livraison sur les commandes qui leur sont assignées.
- Les admins/managers conservent l'accès global existant.

### 1.5 Trigger : auto-notification livreur local

Trigger `trg_notify_local_driver_assignment` sur `orders` quand `assigned_driver_id` change (similaire au `trg_notify_rider_assignment` existant).

**SQL fourni pour SQL Editor production** dans le message d'implémentation.

---

## Phase 2 — Flux de statuts pour boutiques locales

### 2.1 Nouveau flux local dans `order-status.ts`

Ajouter un flux alternatif :
```text
LOCAL_STATUS_FLOW: pending → confirmed → preparing → ready_for_pickup → out_for_delivery → delivered
```

Nouveau statut `ready_for_pickup` (colis prêt chez vendeur/entrepôt Zandofy) avec config visuelle.

Fonctions `canVendorAdvanceLocal()` et `getNextStatusLocal()` en parallèle des existantes.

### 2.2 Condition dans `VendorOrderManager`

Lorsque le composant se charge, vérifier `store.shop_type`. Si `local` :
- Utiliser `LOCAL_STATUS_FLOW` au lieu de `STATUS_FLOW`
- Masquer les modales de sourcing (Alibaba/plateforme)
- Afficher le bouton **"Assigner Livreur"** dès le statut `preparing`
- Permettre au vendeur d'avancer jusqu'à `out_for_delivery` (au lieu de `shipped`)

### 2.3 Assignation livreur locale

Réutiliser le `RiderAssignmentModal` existant en ajoutant un filtre : si `shop_type === 'local'`, écrire dans `assigned_driver_id` au lieu de `assigned_rider_id`. Le trigger DB s'occupe de la notification.

---

## Phase 3 — Interfaces utilisateur

### 3.1 BecomeVendorPage — Choix du profil boutique

Ajouter un champ à l'étape 2 (Boutique) :
- **Type de boutique** : `International (Import)` / `Local (Stock physique)`
- **Type de stockage** : `Entrepôt Zandofy` / `Entrepôt propre` (si local)
- **Gestion flotte** : `Plateforme` / `Flotte propre` (si local)

Sauvegarder dans `vendor_applications`, puis reporter dans `stores` à l'approbation (dans `AdminVendorApplicationsPage`).

### 3.2 Dashboard Vendeur — Adaptation conditionnelle

- Onglet "Commandes" : filtres de statut adaptés selon `shop_type`
- Onglet "Livraisons" (`VendorRiderTracking`) : si `own_fleet`, afficher les livreurs du vendeur

### 3.3 RiderDashboardPage — Livraisons locales

Le dashboard livreur existant fonctionne déjà avec la table `deliveries`. Le trigger `trg_notify_local_driver_assignment` créera aussi un enregistrement `deliveries` pour les commandes locales → le livreur verra ces missions automatiquement.

### 3.4 Interface Client — Badge "En stock local"

- `ProductCard.tsx` : si le store du produit a `shop_type === 'local'`, afficher un badge "🏪 En stock · Livraison rapide"
- `ProductPage.tsx` : même badge + estimation de livraison locale (1-2 jours au lieu de 7-21 jours)

---

## Phase 4 — Hook & Services dédiés

### 4.1 `useLocalDelivery.ts`

Hook encapsulant :
- Calcul des frais via `local_shipping_rates` (lookup par zone/quartier)
- Assignation du livreur
- Avancement du statut local

### 4.2 Admin — Gestion tarifs locaux

Ajouter un sous-onglet dans la page Admin Shipping existante pour gérer les `local_shipping_rates` (CRUD par zone).

---

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| Migration SQL (nouveau) | Enums, colonnes, table, triggers, RLS |
| `frontend/src/lib/order-status.ts` | Ajouter `LOCAL_STATUS_FLOW`, `ready_for_pickup`, fonctions locales |
| `frontend/src/components/vendor/VendorOrderManager.tsx` | Conditionner flux selon `shop_type` |
| `frontend/src/pages/BecomeVendorPage.tsx` | Champs type boutique |
| `frontend/src/pages/admin/AdminVendorApplicationsPage.tsx` | Reporter `shop_type` à la création du store |
| `frontend/src/components/ProductCard.tsx` | Badge stock local |
| `frontend/src/pages/ProductPage.tsx` | Badge + estimation livraison |
| `frontend/src/hooks/useLocalDelivery.ts` (nouveau) | Logique livraison locale |
| `frontend/src/pages/VendorDashboardPage.tsx` | Passer `shop_type` au composant orders |
| `frontend/src/services/api.ts` | Ajouter champs au type Product/Store |

## Contraintes respectées

- **No breaking changes** : tout le nouveau code est conditionné par `if (shop_type === 'local')`. Le flux international reste inchangé.
- **Migrations idempotentes** : `IF NOT EXISTS`, `DROP ... IF EXISTS` partout.
- **RLS** : politiques ajoutées pour les livreurs locaux.
- **Safety Policy** : aucune modification des fichiers interdits, pas de `SELECT *`, pas de raw SQL côté client.

