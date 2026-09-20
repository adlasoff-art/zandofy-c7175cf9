# Zandofy Flutter — Schéma Supabase (parcours client)

> Source : `frontend/src/integrations/supabase/types.ts`, requêtes dans `CartContext`, `WishlistContext`, `api.ts`, `CheckoutPage`, `AuthPage`, `DashboardPage`.
> **Périmètre** : utilisateur final (acheteur). Pas d’admin, pas de modération, pas de stats opérateur.

---

## 1. Architecture données

- **Auth** : Supabase Auth (`auth.users`) — session JWT côté client.
- **Profil** : table `profiles` (1:1 avec `auth.users.id`).
- **Catalogue** : `products` + tables liées (images, couleurs, tailles) ; filtre `publish_status = 'published'`.
- **Panier / favoris** : `cart_items`, `wishlists` (RLS par `user_id`).
- **Commandes** : `orders` + `order_items` + `payment_transactions`.
- **Pas de vues SQL** exposées dans les types générés (`Views: never`) — utiliser tables + RPC documentées.

**Note types générés** : le fichier `types.ts` peut être **en retard** sur la DB (ex. `products.slug`, `cart_items.selected`). Toujours valider sur staging via SQL Editor ou régénérer types.

---

## 2. Tables principales

### 2.1 `profiles`

Profil client (lecture/édition par le user).

| Colonne | Type PG | Nullable | Dart |
|---------|---------|----------|------|
| `id` | `uuid` | NON | `String` (PK = `auth.users.id`) |
| `email` | `text` | OUI | `String?` |
| `first_name` | `text` | OUI | `String?` |
| `last_name` | `text` | OUI | `String?` |
| `phone` | `text` | OUI | `String?` |
| `avatar_url` | `text` | OUI | `String?` |
| `gender` | `text` | OUI | `String?` |
| `date_of_birth` | `date` / `text` | OUI | `DateTime?` ou `String?` |
| `customer_tier` | `text` | NON | `String` (fidélité) |
| `referral_code` | `text` | OUI | `String?` |
| `affiliate_tier` | `text` | OUI | `String?` |
| `is_banned` | `boolean` | NON | `bool` |
| `ban_reason` | `text` | OUI | `String?` |
| `banned_at` | `timestamptz` | OUI | `DateTime?` |
| `created_at` | `timestamptz` | NON | `DateTime` |
| `updated_at` | `timestamptz` | NON | `DateTime` |

**Client** : select/update own row via RLS. Champs ban en lecture seule pour le user.

---

### 2.2 `products`

Articles catalogue (uniquement `publish_status = 'published'` en client).

| Colonne | Type | Nullable | Dart | Notes client |
|---------|------|----------|------|--------------|
| `id` | `uuid` | NON | `String` | |
| `slug` | `text` | NON* | `String` | *Colonne DB (migration `products_ensure_slug`) ; peut manquer dans types.ts |
| `name` | `text` | NON | `String` | EN |
| `name_fr` | `text` | NON | `String` | FR — **affichage principal si locale fr** |
| `price` | `numeric` | NON | `double` | Prix de base USD |
| `original_price` | `numeric` | OUI | `double?` | Prix barré |
| `currency` | `text` | NON | `String` | Défaut souvent `USD` |
| `category_id` | `uuid` | OUI | `String?` | FK `categories` |
| `store_id` | `uuid` | OUI | `String?` | FK `stores` |
| `short_description` | `text` | OUI | `String?` | |
| `description` | `text` | OUI | `String?` | |
| `material` | `text` | OUI | `String?` | |
| `style` | `text` | OUI | `String?` | |
| `origin_country` | `text` | OUI | `String?` | |
| `sku` | `text` | OUI | `String?` | |
| `moq` | `integer` | OUI | `int` | Min order qty, défaut 1 |
| `stock_quantity` | `integer` | OUI | `int?` | |
| `weight_grams` | `integer` | OUI | `int?` | Shipping estimate |
| `length_cm` | `numeric` | OUI | `double?` | |
| `width_cm` | `numeric` | OUI | `double?` | |
| `height_cm` | `numeric` | OUI | `double?` | |
| `is_new` | `boolean` | OUI | `bool` | Badge nouveau |
| `is_sale` | `boolean` | OUI | `bool` | Promo |
| `discount` | `numeric` | OUI | `int?` | % affiché |
| `rating` | `numeric` | OUI | `double?` | |
| `review_count` | `integer` | OUI | `int?` | |
| `review_count_override` | `integer` | OUI | `int?` | Affichage |
| `sales_count_override` | `integer` | OUI | `int?` | |
| `verified_years` | `integer` | OUI | `int?` | |
| `verified_years_override` | `integer` | OUI | `int?` | |
| `promo_start_date` | `timestamptz` | OUI | `DateTime?` | |
| `promo_end_date` | `timestamptz` | OUI | `DateTime?` | |
| `flash_timer_enabled` | `boolean` | OUI | `bool` | |
| `flash_timer_duration_hours` | `integer` | OUI | `int?` | |
| `publish_status` | `text` | NON | `String` | Client : `published` only |
| `meta_title` | `text` | OUI | `String?` | SEO |
| `meta_description` | `text` | OUI | `String?` | |
| `seo_keywords` | `text[]` | OUI | `List<String>?` | |
| `created_at` | `timestamptz` | NON | `DateTime` | |
| `updated_at` | `timestamptz` | NON | `DateTime` | |

**Jointures fréquentes** (select API `mapProduct`) :
```sql
products.*,
categories(name, name_fr),
stores(*),
product_images(image_url, position),
product_colors(color_hex, color_name, image_url),
product_sizes(size_label)
```

**Modèle Dart agrégé** (`Product` dans `api.ts`) : mapper row + jointures vers un seul objet UI.

---

### 2.3 `product_images`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `product_id` | `uuid` | `String` |
| `image_url` | `text` | `String` (URL HTTPS) |
| `position` | `integer` | `int?` | Tri gallery |
| `embedding_status` | `text` | `String?` | Ignorer client |

---

### 2.4 `product_colors`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `product_id` | `uuid` | `String` |
| `color_name` | `text` | `String` |
| `color_hex` | `text` | `String` (#RRGGBB) |
| `image_url` | `text` | `String?` |

---

### 2.5 `product_sizes`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `product_id` | `uuid` | `String` |
| `size_label` | `text` | `String` |
| `region` | `text` | `String?` |
| `bust_cm` | `numeric` | `double?` |
| `waist_cm` | `numeric` | `double?` |
| `hips_cm` | `numeric` | `double?` |

---

### 2.6 `product_pricing_tiers` (prix par quantité)

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `product_id` | `uuid` | `String` |
| `tier_label` | `text` | `String` |
| `min_quantity` | `integer` | `int` |
| `discount_type` | `text` | `String` | `percentage` / `fixed` |
| `discount_value` | `numeric` | `double` |

---

### 2.7 `categories`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `name` | `text` | `String` | EN |
| `name_fr` | `text` | `String` | FR |
| `parent_id` | `uuid` | `String?` | Arbre catégories |
| `icon` | `text` | `String?` | |
| `image_url` | `text` | `String?` | |
| `og_image_url` | `text` | `String?` | |
| `meta_title` | `text` | `String?` | |
| `meta_description` | `text` | `String?` | |
| `seo_keywords` | `text[]` | `List<String>?` | |
| `created_at` | `timestamptz` | `DateTime` | |

Navigation : slug calculé côté client via `category-slug.ts` (pas toujours colonne DB) — utiliser `name_fr`/`name` pour URLs `/category/{slug}`.

---

### 2.8 `stores` (boutiques — lecture client)

| Colonne | Type | Dart | Notes |
|---------|------|------|-------|
| `id` | `uuid` | `String` | |
| `name` | `text` | `String` | |
| `description` | `text` | `String?` | |
| `logo_url` | `text` | `String?` | |
| `banner_url` | `text` | `String?` | |
| `is_verified` | `boolean` | `bool?` | Badge |
| `is_online` | `boolean` | `bool?` | |
| `rating` | `numeric` | `double?` | |
| `products_count` | `integer` | `int?` | |
| `followers_count` | `integer` | `int?` | |
| `sales_count` | `integer` | `int?` | |
| `verified_years` | `integer` | `int?` | |
| `whatsapp_number` | `text` | `String?` | Contact |
| `created_at` | `timestamptz` | `DateTime` | |

Champs modération / owner / overrides : lecture OK, pas d’édition client.

---

### 2.9 `cart_items`

| Colonne | Type | Dart | Notes |
|---------|------|------|-------|
| `id` | `uuid` | `String` | |
| `user_id` | `uuid` | `String` | FK auth |
| `product_id` | `uuid` | `String` | |
| `quantity` | `integer` | `int` | |
| `color` | `text` | `String?` | Variante |
| `size` | `text` | `String?` | Variante |
| `selected` | `boolean` | `bool` | *Utilisé par le web ; vérifier colonne en DB* |
| `created_at` | `timestamptz` | `DateTime` | |

**Requête panier** (`CartContext`) :
```typescript
.from("cart_items")
.select(`
  id, product_id, color, size, quantity, selected,
  products(name, name_fr, price, original_price, moq,
    product_images(image_url, position))
`)
.eq("user_id", user.id)
```

---

### 2.10 `wishlists`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `user_id` | `uuid` | `String` |
| `product_id` | `uuid` | `String` |
| `created_at` | `timestamptz` | `DateTime` |

Unique logique : `(user_id, product_id)` — toggle insert/delete.

---

### 2.11 `saved_addresses`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `user_id` | `uuid` | `String` |
| `label` | `text` | `String` | ex. « Maison » |
| `first_name` | `text` | `String` |
| `last_name` | `text` | `String` |
| `phone` | `text` | `String` |
| `address` | `text` | `String` |
| `city` | `text` | `String` |
| `country` | `text` | `String` | défaut selon insert |
| `postal_code` | `text` | `String?` |
| `is_default` | `boolean` | `bool` | |
| `created_at` | `timestamptz` | `DateTime` |

---

### 2.12 `orders`

| Colonne | Type | Dart | Notes |
|---------|------|------|-------|
| `id` | `uuid` | `String` | |
| `order_ref` | `text` | `String` | Référence affichée |
| `user_id` | `uuid` | `String` | |
| `store_id` | `uuid` | `String?` | |
| `status` | `text` | `String` | Voir §4 statuts |
| `subtotal` | `numeric` | `double` | |
| `shipping_cost` | `numeric` | `double` | |
| `discount_amount` | `numeric` | `double?` | |
| `total` | `numeric` | `double` | |
| `payment_method` | `text` | `String?` | card, mobile_money, cod, off_platform… |
| `coupon_code` | `text` | `String?` | |
| `delivery_choice` | `text` | `String?` | hub / home_delivery |
| `last_mile_fee` | `numeric` | `double?` | |
| `last_mile_payment_method` | `text` | `String?` | |
| `confirmation_code` | `text` | `String?` | Code réception |
| `tracking_number` | `text` | `String?` | |
| `assigned_rider_id` | `uuid` | `String?` | |
| `assigned_rider_name` | `text` | `String?` | |
| `shipping_first_name` | `text` | `String?` | Snapshot adresse |
| `shipping_last_name` | `text` | `String?` | |
| `shipping_email` | `text` | `String?` | |
| `shipping_phone` | `text` | `String?` | |
| `shipping_address` | `text` | `String?` | |
| `shipping_city` | `text` | `String?` | |
| `shipping_country` | `text` | `String?` | |
| `shipping_postal_code` | `text` | `String?` | |
| `off_platform_vendor_verified_at` | `timestamptz` | `DateTime?` | Paiement hors plateforme |
| `created_at` | `timestamptz` | `DateTime` | |
| `updated_at` | `timestamptz` | `DateTime` | |

---

### 2.13 `order_items`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `order_id` | `uuid` | `String` |
| `product_id` | `uuid` | `String?` |
| `product_name` | `text` | `String` | Snapshot |
| `product_image` | `text` | `String?` | URL snapshot |
| `price` | `numeric` | `double` | Prix unitaire commandé |
| `quantity` | `integer` | `int` |
| `color` | `text` | `String?` |
| `size` | `text` | `String?` |
| `created_at` | `timestamptz` | `DateTime` |

---

### 2.14 `payment_transactions`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `order_id` | `uuid` | `String` |
| `user_id` | `uuid` | `String` |
| `reference` | `text` | `String` | KelPay ref |
| `amount` | `numeric` | `double` |
| `currency` | `text` | `String` |
| `method` | `text` | `String` | |
| `provider` | `text` | `String?` | kelpay, keccel… |
| `status` | `text` | `String` | pending, success, failed… |
| `phone_number` | `text` | `String?` | Mobile Money |
| `transaction_id` | `text` | `String?` | |
| `callback_payload` | `jsonb` | `Map<String,dynamic>?` | |
| `created_at` | `timestamptz` | `DateTime` |
| `updated_at` | `timestamptz` | `DateTime` |

---

### 2.15 `reviews`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `product_id` | `uuid` | `String` |
| `user_id` | `uuid` | `String` |
| `rating` | `integer` | `int` | 1–5 |
| `comment` | `text` | `String` | |
| `images` | `text[]` | `List<String>?` | |
| `is_verified_purchase` | `boolean` | `bool` | |
| `helpful_count` | `integer` | `int` | |
| `created_at` | `timestamptz` | `DateTime` |

---

### 2.16 `coupons` (application checkout)

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `code` | `text` | `String` |
| `discount_type` | `text` | `String` | percentage / fixed |
| `discount_value` | `numeric` | `double` |
| `min_order_amount` | `numeric` | `double?` |
| `max_uses` | `integer` | `int?` |
| `used_count` | `integer` | `int?` |
| `expires_at` | `timestamptz` | `DateTime?` |
| `store_id` | `uuid` | `String?` | Coupon boutique |
| `is_active` | `boolean` | `bool` | |

---

### 2.17 `notifications`

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `user_id` | `uuid` | `String` |
| `title` | `text` | `String` |
| `body` | `text` | `String?` |
| `type` | `text` | `String?` | |
| `link` | `text` | `String?` | Deep link |
| `read` | `boolean` | `bool` | |
| `created_at` | `timestamptz` | `DateTime` |

---

### 2.18 Messagerie (`conversations`, `messages`)

**`conversations`**

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `store_id` | `uuid` | `String` | |
| `customer_id` | `uuid` | `String` | = user |
| `product_id` | `uuid` | `String?` | Contexte produit |
| `last_message_at` | `timestamptz` | `DateTime?` | |
| `created_at` | `timestamptz` | `DateTime` | |

**`messages`**

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `conversation_id` | `uuid` | `String` |
| `sender_id` | `uuid` | `String` |
| `content` | `text` | `String` | |
| `attachment_url` | `text` | `String?` | |
| `read_at` | `timestamptz` | `DateTime?` | |
| `created_at` | `timestamptz` | `DateTime` | |

---

### 2.19 Litiges & retours (dashboard client)

**`return_requests`**

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `order_id` | `uuid` | `String` |
| `user_id` | `uuid` | `String` |
| `store_id` | `uuid` | `String?` |
| `reason` | `text` | `String` |
| `description` | `text` | `String?` |
| `status` | `text` | `String` | |
| `refund_amount` | `numeric` | `double` | |
| `refund_method` | `text` | `String?` | |
| `created_at` | `timestamptz` | `DateTime` | |

**`disputes`** — liés commande ; lecture client sur ses commandes.

---

### 2.20 `referrals` (parrainage à l’inscription)

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `referrer_id` | `uuid` | `String` |
| `referee_id` | `uuid` | `String` |
| `commission_pct` | `numeric` | `double` |
| `max_rewarded_orders` | `integer` | `int` |
| `rewarded_orders_count` | `integer` | `int` |
| `status` | `text` | `String` | |
| `created_at` | `timestamptz` | `DateTime` |

---

### 2.21 `platform_settings` (lecture seule client)

Clés JSON utiles :
- `exchange_rates` / taux devises
- `referral_settings`
- `cms_texts` (overrides i18n)
- `geo_active_countries`
- thème CMS (couleurs)

| Colonne | Type |
|---------|------|
| `key` | `text` PK |
| `value` | `jsonb` |
| `updated_at` | `timestamptz` |

---

### 2.22 `trend_tags` (navigation tendances)

| Colonne | Type | Dart |
|---------|------|------|
| `id` | `uuid` | `String` |
| `name` | `text` | `String` |
| `name_fr` | `text` | `String` |
| `slug` | `text` | `String` |
| `sort_order` | `integer` | `int` |

---

## 3. Fonctions RPC / Edge (client)

| Nom | Usage client | Auth |
|-----|--------------|------|
| `get_product_rating_summary` | Distribution étoiles PDP | anon/user |
| `get_product_real_stats` | Stats réelles produit | anon/user |
| `get_customer_loyalty_stats` | Dashboard fidélité | user |
| `get_store_sales_count` | Page boutique | anon |
| `get_store_followers_count` | Page boutique | anon |
| `match_products_by_image` | Recherche visuelle | user |
| `has_role` | Garde routes (pas nécessaire app client pure) | user |

**Edge Functions invoquées par le client** :
| Function | Usage |
|----------|-------|
| `kelpay-payment` | Mobile Money |
| `kelpay-check` | Statut paiement |
| `keccel-cardpay` | Carte |
| `calculate-shipping` | Estimation frais |
| `visual-search` | Recherche image |
| `get-store-whatsapp` | Lien WhatsApp boutique |
| `notify-operator-new-order` | Post-commande (interne) |

Secrets Meta / social : **non** côté client.

---

## 4. Enums & statuts métier

### 4.1 `orders.status`

Valeurs (`order-status.ts`) :
`awaiting_payment`, `pending`, `confirmed`, `preparing`, `in_shipping`, `shipped`, `assigning_rider`, `rider_assigned`, `out_for_delivery`, `ready_for_pickup`, `delivered`, `cancelled`, `returned`, `payment_failed`

### 4.2 `payment_transactions.status`

Typique : `pending`, `success`, `failed`, `cancelled` (confirmer en DB).

### 4.3 `payment_method` (commande)

Web : `card`, `mobile_money`, `cod`, `off_platform`, `paypal` (affichage dashboard).

### 4.4 `delivery_choice`

`hub` (retrait hub), `home_delivery` (domicile).

---

## 5. Modèle Dart recommandé (extrait)

```dart
@JsonSerializable()
class Product {
  final String id;
  final String slug;
  final String name;
  final String nameFr;
  final double price;
  final double? originalPrice;
  final String currency;
  final int moq;
  final List<ProductImage> images;
  final List<ProductColor> colors;
  final List<String> sizes;
  final StoreSummary? store;
  // ...
}

@JsonSerializable()
class CartItem {
  final String id;
  final String productId;
  final int quantity;
  final String? color;
  final String? size;
  final bool selected;
  final ProductSummary? product; // jointure
}

@JsonSerializable()
class Order {
  final String id;
  final String orderRef;
  final String status;
  final double subtotal;
  final double shippingCost;
  final double total;
  final String? paymentMethod;
  final List<OrderItem> items;
  final DateTime createdAt;
}
```

Utiliser `freezed` + `json_serializable` ; parser `numeric` PostgreSQL en `double` ; `timestamptz` en `DateTime` UTC.

---

## 6. RLS & sécurité (rappel Flutter)

- Clé publique Supabase dans l’app (`VITE_SUPABASE_ANON_KEY` équivalent).
- **Jamais** service role dans l’app mobile.
- Panier, favoris, commandes, adresses : filtrage `user_id = auth.uid()`.
- Produits : policy lecture si `publish_status = 'published'`.

---

## 7. Tables explicitement **hors** scope app client

`admin_*`, `social_post_*`, `kyc_audit_logs`, `operator_*`, `forwarder_*`, `vendor_*` admin, `cms_pages` édition, analytics brutes, modération, etc.
