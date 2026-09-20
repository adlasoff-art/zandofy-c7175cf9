# Zandofy Flutter — Rôles, Vendeurs et Livreurs (Supabase)

> Source : `frontend/src/hooks/use-roles.ts`, `RoleGuard.tsx`, `MobileAccountMenu.tsx`, `VendorDashboardPage.tsx`, `RiderDashboardPage.tsx`, `ShipperDashboardPage.tsx`, `frontend/src/integrations/supabase/types.ts`, migrations RLS.
> **Périmètre mobile** : Client + Vendeur (`vendor`) + Livreur (`rider`). Admin / Manager / Opérateur / Transitaire / Expéditeur restent sur le **web**.

---

## 1. Modèle de rôles dans Supabase

### 1.1 Pas de claim JWT custom pour le rôle

- L’auth utilise **Supabase Auth** (`auth.users`) avec le JWT standard (`sub`, `email`, etc.).
- Le **rôle applicatif n’est pas** dans `user_metadata` ni dans un custom JWT claim documenté.
- Les rôles sont stockés en **table PostgreSQL** et lus côté client après login.

### 1.2 Enum PostgreSQL `app_role`

Défini dans la DB (enum `public.app_role`). Valeurs utilisées dans le code :

| Valeur DB | UI FR (web) | App mobile Flutter |
|-----------|-------------|-------------------|
| *(aucune ligne)* | Client (acheteur) | **Client** — accueil boutique |
| `vendor` | Vendeur | **Vendeur** — dashboard vendeur |
| `rider` | Livreur | **Livreur** — liste des courses |
| `admin` | Administration | **Web uniquement** (message ou deep link) |
| `manager` | Administration | **Web uniquement** |
| `shipper` | Expéditeur (hub / fret) | **Hors scope mobile v1** (≠ livreur) |
| `operator` | Opérateur de livraison | **Web uniquement** |
| `forwarder` | Transitaire | **Web uniquement** |

**Important — Livreur vs Expéditeur :**

- **Livreur** = rôle `rider` → dashboard `/rider`, courses last-mile, table `deliveries`, `orders.assigned_rider_id`.
- **Expéditeur** = rôle `shipper` → dashboard `/shipper`, fret international, table `shipments`, remise hub → livreur. Ne pas confondre dans le routage Flutter.

Le fichier `types.ts` généré peut lister un sous-set de l’enum ; le hook `use-roles.ts` et la DB staging peuvent inclure `operator` / `forwarder` en plus.

### 1.3 Table `user_roles`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `role` | `app_role` | Un rôle par ligne |
| `created_at` | `timestamptz` | |

- Un utilisateur peut avoir **plusieurs rôles** (ex. `vendor` + `rider`).
- RLS : lecture typique sur ses propres lignes ; insertion/update réservée staff (`has_role(..., 'admin')`).

**Client Flutter — lecture des rôles :**

```dart
// Option A — table directe (comme useRoles web)
final rows = await supabase.from('user_roles').select('role').eq('user_id', userId);

// Option B — RPC (préférable, SECURITY DEFINER)
final roles = await supabase.rpc('get_user_roles', params: {'_user_id': userId});
```

### 1.4 Fonctions SQL `has_role` et `get_user_roles`

| Fonction | Args | Retour | Usage |
|----------|------|--------|-------|
| `has_role` | `_user_id uuid`, `_role app_role` | `boolean` | **RLS policies** côté serveur |
| `get_user_roles` | `_user_id uuid` | `app_role[]` | Lecture agrégée des rôles |

Ces fonctions ne remplacent pas l’auth : elles contrôlent les **permissions DB**. Le client Flutter doit quand même appeler `get_user_roles` ou `user_roles` pour le **routage UI**.

### 1.5 Table `profiles` (commune à tous les rôles)

Tous les utilisateurs ont une ligne `profiles` (`id` = `auth.users.id`). Champs utiles mobile :

- `email`, `first_name`, `last_name`, `phone`, `avatar_url`
- `is_banned`, `ban_reason` — bloquer l’accès si banni
- `customer_tier`, `login_count`, `last_login_at`

Le rôle **n’est pas** sur `profiles` : toujours `user_roles`.

### 1.6 Détermination du rôle « Client »

- **Client** = utilisateur authentifié **sans** rôle mobile prioritaire (`vendor`, `rider`) pour la session courante.
- Tout compte peut acheter même s’il a aussi le rôle `vendor` (le web affiche les deux espaces dans `MobileAccountMenu`).

**Stratégie routage Flutter (multi-rôles) :**

1. Charger `get_user_roles`.
2. Si `admin` ou `manager` seul → écran « Utilisez le web » ou lien `https://www.zandofy.com/admin`.
3. Si `vendor` et `rider` → **sélecteur de mode** ou dernier mode mémorisé (`SharedPreferences`).
4. Sinon : `vendor` → vendeur ; `rider` → livreur ; défaut → client.

---

## 2. Tables et données — Vendeur (`vendor`)

### 2.1 Boutique et identité

| Table | Rôle vendeur | Colonnes / notes clés |
|-------|--------------|----------------------|
| `stores` | Boutique(s) du vendeur | `owner_id` = `user.id` ; `name`, `logo_url`, `banner_url`, `description`, `whatsapp_number`, `shop_type` (`international` \| `local`), `is_suspended`, `is_banned`, `collaborators_enabled`, compteurs (`products_count`, `followers_count`) |
| `store_collaborators` | Équipe boutique (hors types générés) | `store_id`, `user_id`, `sub_role`, `permissions`, `status` — masquage PII pour certains collaborateurs |
| `vendor_applications` | Onboarding vendeur | `status`, `store_name`, documents, `current_step` — flux `/become-vendor` |
| `vendor_documents` | KYB / documents | Liés au vendeur / store |
| `vendor_subscriptions` | Abonnement tier | Tier `beginner` \| `pro` \| `grand_supplier`, limites produits |
| `vendor_pricing_overrides` | Options store | `suppliers_enabled`, etc. |

**Accès store :** `stores` où `owner_id = auth.uid()` OU collaborateur actif dans `store_collaborators`.

### 2.2 Catalogue et stock

| Table | Usage vendeur |
|-------|---------------|
| `products` | CRUD articles ; `store_id`, `publish_status` (`draft`, `pending_approval`, `published`, `rejected`, `revision_requested`), `stock_quantity`, prix, dimensions, `slug` |
| `product_images` | Images (`image_url`, `position`) — bucket Storage `product-media` |
| `product_sizes` | Tailles / mesures |
| `product_colors` | Couleurs + image variante |
| `product_variant_selections` | Variantes dynamiques (catégorie) |
| `product_custom_variant_values` | Valeurs custom variantes |
| `categories` | Liste pour formulaire (lecture) |
| `trend_tags` | Tags tendance (lecture) |

**Workflow publication :** nouveau produit → soumission `pending_approval` ; modération admin → `published`. Édition d’un produit publié → repasse en `pending_approval`.

### 2.3 Commandes entrantes

| Table | Usage vendeur |
|-------|---------------|
| `orders` | Filtre `store_id` = boutique active ; statuts via `order-status.ts` |
| `order_items` | Lignes commande (snapshot nom, prix, qty, couleur, taille) |
| `order_status_history` | Historique transitions |
| `payment_transactions` | Paiements liés (lecture) |

Colonnes `orders` critiques pour le vendeur :

- Statut : `pending` → … → `delivered` (flux international vs local)
- `assigned_rider_id`, `assigned_rider_name`, `delivery_operator_id`
- `tracking_number`, `supplier_order_number`, `confirmation_code`
- `delivery_choice`, `last_mile_fee`, `last_mile_payment_method`, `rider_cash_collected`
- Off-platform : `off_platform_vendor_verified_at`, preuves paiement

**RLS :** policies basées sur `can_access_store_orders` / ownership store (voir migrations).

### 2.4 Livraisons (vue vendeur)

| Table | Usage |
|-------|--------|
| `deliveries` | Suivi livreur assigné (`VendorRiderTracking`) — lié `order_id`, `rider_id` |
| `rider_locations` | Position GPS livreur (lecture temps réel) |

### 2.5 Promotions, wallet, retours

| Table | Usage |
|-------|--------|
| `store_coupons` | Coupons boutique |
| `vendor_wallets` | Solde vendeur |
| `vendor_transactions` | Mouvements wallet |
| `vendor_delivery_zones` | Zones de livraison |
| Retours / litiges | Tables `returns`, `disputes`, `dispute_messages` (composants `VendorReturnsTab`, `VendorDisputesTab`) |

### 2.6 Messagerie

| Table / RPC | Usage |
|-------------|--------|
| `conversations` + messages | Chat client ↔ vendeur (`InternalChat`) |
| RPC `vendor_conversation_summary` | Liste conversations agrégée (remplace N+1) |

### 2.7 Storage (vendeur)

| Bucket | Usage |
|--------|--------|
| `product-media` | Images / vidéos produits (public URL) |
| Preuves paiement | URLs sur `orders` (shipping / last mile) |

### 2.8 RPC utiles vendeur

| RPC | Usage |
|-----|--------|
| `vendor_conversation_summary` | `_store_id` → liste conversations |
| `get_store_sales_count` | Stats |
| `get_store_followers_count` | Stats |

---

## 3. Tables et données — Livreur (`rider`)

### 3.1 Assignation des courses

Deux flux parallèles dans `RiderDashboardPage` :

#### A. Table `deliveries` (courses « traditionnelles »)

| Colonne | Description |
|---------|-------------|
| `rider_id` | Livreur assigné (**RLS filtre par ce champ**) |
| `order_id`, `order_ref` | Lien commande optionnel |
| `customer_name`, `customer_phone`, `address` | Destination |
| `delivery_lat`, `delivery_lng` | Coordonnées |
| `items_count`, `amount` | Résumé course |
| `status` | `pending` \| `in_progress` \| `delivered` |
| `delivery_date`, `delivered_at` | Planning / clôture |
| `proof_photo_url`, `signature_url` | Preuves (paths bucket privé) |
| `notes` | Notes |

#### B. Table `orders` (commandes last-mile)

Filtre : `assigned_rider_id = auth.uid()`.

Champs utilisés par le livreur :

- `order_ref`, `status`, `total`, adresse livraison (`shipping_*`)
- `delivery_choice`, `last_mile_fee`, `last_mile_payment_method`, `last_mile_payment_status`
- `confirmation_code`, `rider_cash_collected`
- Statuts actifs : `rider_assigned`, `out_for_delivery`, `ready_for_pickup`, hub statuses, etc.

**Clôture livraison commande :** `orders.update({ status: 'delivered' })` après code confirmation + cash si applicable.

### 3.2 Géolocalisation temps réel

| Table | Usage |
|-------|--------|
| `rider_locations` | Upsert GPS (`rider_id`, `delivery_id`, lat/lng, heading, speed) — Realtime pour le client |

Hook web : `useRiderLocationBroadcast` — actif quand une `delivery` est `in_progress`.

### 3.3 Évaluations livreur

| Table | Usage |
|-------|--------|
| `rider_ratings` | `rider_id`, `rating`, `comment` — profil livreur |

### 3.4 Invitations livreur

Page web `/rider-invite` — rattachement compte au pool livreurs (admin / opérateur). Pas de table dédiée exposée dans les types générés du flux invite (vérifier `delivery_operator_riders` côté opérateur).

### 3.5 Storage (livreur)

| Bucket | Usage |
|--------|--------|
| `delivery-proofs` | Photos + signatures (`signatures/`, `photos/`) — **privé** ; affichage via signed URL |

### 3.6 Notifications

Insertion `notifications` pour demander GPS client (`type: delivery`) depuis la carte livreur.

---

## 4. Flux de statuts commande (référence vendeur / livreur)

### 4.1 Boutique internationale (`shop_type = international`)

```
pending → confirmed → preparing → in_shipping → shipped
  → assigning_rider → rider_assigned → out_for_delivery → delivered
```

- Vendeur peut avancer jusqu’à **`shipped`** (index max vendeur international).
- Passage `shipped → assigning_rider` : assignation livreur (modal).
- Livreur : commandes avec `assigned_rider_id` ; statut final `delivered`.

### 4.2 Boutique locale (`shop_type = local`)

```
pending → confirmed → preparing → ready_for_pickup → out_for_delivery → delivered
```

- Vendeur peut avancer jusqu’à **`out_for_delivery`** sur le flux local.
- Assignation livreur à `preparing → ready_for_pickup`.

### 4.3 Table `deliveries` (statuts simplifiés)

```
pending → in_progress → delivered
```

---

## 5. Sécurité et RLS (résumé Flutter)

| Action | Mécanisme |
|--------|-----------|
| Lire ses rôles | `user_roles` ou `get_user_roles` |
| Vendeur lit commandes | RLS `orders` via `store_id` / `can_access_store_orders` |
| Vendeur CRUD produits | RLS `products` via `store_id` ownership |
| Livreur lit courses | RLS `deliveries` via `rider_id` ; `orders` via `assigned_rider_id` |
| Livreur update statut | UPDATE sur lignes assignées uniquement |
| Staff (`admin`, `manager`) | Policies `has_role` — **ne pas exposer UI admin dans l’app mobile v1** |

**Ne jamais** utiliser la `service_role` dans l’app Flutter — uniquement `anon` + session user.

---

## 6. Mapping Flutter ↔ Supabase (routage initial)

```dart
enum MobilePersona { client, vendor, rider, staffWebOnly }

Future<MobilePersona> resolvePersona(String userId) async {
  final roles = await supabase.rpc('get_user_roles', params: {'_user_id': userId})
      as List<dynamic>;
  final set = roles.map((r) => r.toString()).toSet();

  if (set.contains('admin') || set.contains('manager')) {
    return MobilePersona.staffWebOnly;
  }
  // Multi-rôle : lire préférence locale ou afficher picker
  if (set.contains('vendor')) return MobilePersona.vendor;
  if (set.contains('rider')) return MobilePersona.rider;
  return MobilePersona.client;
}
```

Correspondance demandée produit :

| Condition | Route Flutter |
|-----------|---------------|
| Non connecté | `/auth` |
| `client` | `/home` (accueil boutique) |
| `vendor` | `/vendor/dashboard` |
| `rider` | `/rider/deliveries` |

---

## 7. Écarts types générés vs DB

Vérifier sur **staging** avant implémentation :

- `store_collaborators`, `shop_type` sur `stores`
- Enum `app_role` complet (`operator`, `forwarder`)
- `products.slug`, `publish_status` étendu
- Tables opérateur (`delivery_operators`, `delivery_operator_riders`) — web only

Régénérer types Supabase ou documenter les champs manquants comme dans `02_supabase_schema_clients.md`.
