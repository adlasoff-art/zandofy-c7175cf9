# Zandofy — Spécification Complète du Backend FastAPI

> Ce document est destiné à Cursor AI pour implémenter le backend FastAPI de Zandofy.
> Il décrit TOUTES les tables, fonctions, triggers, endpoints, flux d'authentification et logique métier du projet.

---

## 1. VUE D'ENSEMBLE

Zandofy est une marketplace e-commerce multi-vendeurs (type Shein/AliExpress) ciblant la RDC et l'Afrique.

### Stack cible

```
VPS Hostinger (4 vCPU / 16GB RAM / 200GB NVMe)
├── FastAPI (Python 3.11+) → Backend principal
│   ├── SQLAlchemy + Alembic → ORM + migrations
│   ├── FastAPI-Users ou custom JWT → Auth
│   ├── Celery + Redis → Tâches async (emails, CRON)
│   ├── SMTP (nodemailer → smtplib) → Emails
│   └── WeasyPrint ou ReportLab → Factures PDF
├── PostgreSQL 15 → Base de données
├── Redis → Cache + Celery broker
├── Nginx → Reverse proxy + frontend static
├── Dokploy → CI/CD depuis GitHub
└── Frontend React/Vite (dist/) → Servi par Nginx
```

### Frontend actuel

Le frontend React communique actuellement avec Supabase via `@supabase/supabase-js`. Il faudra :
1. Remplacer les appels Supabase par des appels `fetch()` vers l'API FastAPI
2. Gérer l'auth via JWT (localStorage)
3. Les fichiers concernés sont principalement dans `src/services/`, `src/contexts/AuthContext.tsx`, et les composants qui importent `supabase` directement

---

## 2. SCHÉMA DE BASE DE DONNÉES (34+ tables)

### 2.1 Auth & Utilisateurs

```sql
-- Table profiles (créée automatiquement à l'inscription)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,  -- bcrypt
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    date_of_birth DATE,
    gender TEXT,
    referral_code TEXT UNIQUE,
    affiliate_tier TEXT DEFAULT NULL,
    customer_tier TEXT DEFAULT 'bronze',
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    banned_by UUID,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rôles séparés (CRITIQUE pour la sécurité)
CREATE TYPE app_role AS ENUM ('admin', 'manager', 'vendor', 'shipper', 'rider');

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
```

### 2.2 Boutiques (Stores)

```sql
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    description TEXT,
    country TEXT DEFAULT 'CD',
    city TEXT,
    whatsapp_number TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_years INTEGER DEFAULT 0,
    verified_years_override INTEGER,
    is_online BOOLEAN DEFAULT TRUE,
    products_count INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    followers_override INTEGER,
    sales_count INTEGER DEFAULT 0,
    sales_override INTEGER,
    sales_trend TEXT DEFAULT 'stable',
    repurchase_rate NUMERIC DEFAULT 0,
    rating NUMERIC DEFAULT 0,
    response_rate NUMERIC DEFAULT 0,
    response_time TEXT DEFAULT '< 24h',
    flash_timer_enabled BOOLEAN DEFAULT FALSE,  -- self-delivery flag
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE store_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(store_id, user_id)
);

CREATE TABLE store_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.3 Catégories

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    icon TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES categories(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE category_surcharges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) UNIQUE,
    surcharge_type TEXT DEFAULT 'percentage',
    surcharge_value NUMERIC DEFAULT 0,
    label TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.4 Produits

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    category_id UUID REFERENCES categories(id),
    name TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    price NUMERIC NOT NULL,
    original_price NUMERIC,
    currency TEXT DEFAULT 'USD',
    discount NUMERIC DEFAULT 0,
    is_sale BOOLEAN DEFAULT FALSE,
    is_new BOOLEAN DEFAULT FALSE,
    moq INTEGER DEFAULT 1,
    sku TEXT,
    material TEXT,
    style TEXT,
    origin_country TEXT,
    stock_quantity INTEGER,
    weight_grams INTEGER,
    length_cm NUMERIC,
    width_cm NUMERIC,
    height_cm NUMERIC,
    rating NUMERIC DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    review_count_override INTEGER,
    sales_count_override INTEGER,
    verified_years INTEGER,
    verified_years_override INTEGER,
    publish_status TEXT DEFAULT 'draft',  -- draft, published, archived
    promo_start_date TIMESTAMPTZ,
    promo_end_date TIMESTAMPTZ,
    flash_timer_enabled BOOLEAN DEFAULT FALSE,
    flash_timer_duration_hours INTEGER,
    meta_title TEXT,
    meta_description TEXT,
    seo_keywords TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    position INTEGER
);

CREATE TABLE product_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    color_hex TEXT NOT NULL,
    color_name TEXT NOT NULL,
    image_url TEXT
);

CREATE TABLE product_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    size_label TEXT NOT NULL,
    region TEXT,
    bust_cm NUMERIC,
    waist_cm NUMERIC,
    hips_cm NUMERIC
);

CREATE TABLE product_pricing_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    tier_label TEXT NOT NULL,
    min_quantity INTEGER NOT NULL,
    discount_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.5 Commandes

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    store_id UUID REFERENCES stores(id),
    order_ref TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending',
    -- Statuts possibles: pending, confirmed, processing, in_shipping, shipped, 
    --   out_for_delivery, delivered, cancelled, returned, payment_failed, refunded
    subtotal NUMERIC DEFAULT 0,
    shipping_cost NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    coupon_code TEXT,
    payment_method TEXT,  -- mobile_money, cod, card
    delivery_choice TEXT,  -- home_delivery, hub_pickup
    last_mile_fee NUMERIC DEFAULT 0,
    last_mile_payment_method TEXT,
    tracking_number TEXT,
    confirmation_code TEXT,
    assigned_rider_id UUID,
    assigned_rider_name TEXT,
    shipping_first_name TEXT,
    shipping_last_name TEXT,
    shipping_email TEXT,
    shipping_phone TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_country TEXT,
    shipping_postal_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_image TEXT,
    price NUMERIC NOT NULL,
    quantity INTEGER DEFAULT 1,
    size TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    changed_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    size TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.6 Paiements

```sql
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    user_id UUID REFERENCES profiles(id),
    method TEXT DEFAULT 'mobile_money',
    provider TEXT,  -- mpesa, airtel_money, orange_money
    phone_number TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    reference TEXT NOT NULL UNIQUE,
    transaction_id TEXT,
    status TEXT DEFAULT 'pending',  -- pending, success, failed
    callback_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.7 Shipping & Logistics

```sql
CREATE TABLE logistic_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    continent TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- Linked to logistic_zones via cities
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    population INTEGER,
    zone_id UUID REFERENCES shipping_zones(id),
    logistic_zone_id UUID REFERENCES logistic_zones(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shipping_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_zone_id UUID REFERENCES shipping_zones(id),
    destination_zone_id UUID REFERENCES shipping_zones(id),
    transport_mode TEXT DEFAULT 'road',  -- road, air, sea, rail
    rate_price NUMERIC DEFAULT 0,
    rate_unit TEXT DEFAULT 'kg',  -- kg, cbm, km, unit
    min_charge NUMERIC DEFAULT 0,
    fuel_surcharge_pct NUMERIC DEFAULT 0,
    transit_days_min INTEGER,
    transit_days_max INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shipping_defaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT NOT NULL UNIQUE,
    default_rate NUMERIC DEFAULT 0,
    rate_unit TEXT DEFAULT 'kg',
    currency TEXT DEFAULT 'USD',
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipper_id UUID REFERENCES profiles(id),
    awb_bl TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    mode TEXT DEFAULT 'air',
    status TEXT DEFAULT 'pending',
    eta TEXT,
    items_count INTEGER DEFAULT 0,
    value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES profiles(id) NOT NULL,
    order_id UUID REFERENCES orders(id),
    order_ref TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    address TEXT NOT NULL,
    delivery_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'assigned',  -- assigned, picked_up, in_transit, delivered, failed
    amount NUMERIC DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    notes TEXT,
    proof_photo_url TEXT,
    signature_url TEXT,
    delivery_lat NUMERIC,
    delivery_lng NUMERIC,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rider_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES profiles(id) NOT NULL,
    delivery_id UUID REFERENCES deliveries(id),
    latitude NUMERIC DEFAULT 0,
    longitude NUMERIC DEFAULT 0,
    heading NUMERIC,
    speed NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE saved_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    label TEXT DEFAULT 'home',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'CD',
    postal_code TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.8 Avis

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    images TEXT[],
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.9 Retours & Litiges

```sql
CREATE TABLE return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    user_id UUID REFERENCES profiles(id),
    store_id UUID REFERENCES stores(id),
    reason TEXT DEFAULT '',
    description TEXT,
    refund_amount NUMERIC DEFAULT 0,
    refund_method TEXT,
    status TEXT DEFAULT 'pending',  -- pending, approved, rejected, completed
    admin_notes TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    user_id UUID REFERENCES profiles(id),
    store_id UUID REFERENCES stores(id),
    reason TEXT DEFAULT '',
    description TEXT,
    priority TEXT DEFAULT 'medium',  -- low, medium, high, critical
    status TEXT DEFAULT 'open',  -- open, in_review, resolved, closed
    resolution TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    return_request_id UUID REFERENCES return_requests(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dispute_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID REFERENCES disputes(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    content TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.10 Messagerie

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    store_id UUID REFERENCES stores(id),
    product_id UUID REFERENCES products(id),
    is_starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.11 Notifications

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    type TEXT DEFAULT 'info',  -- order, delivery, message, points, return, dispute, promo, shipment, info
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, endpoint)
);
```

### 2.12 Fidélité & Parrainage

```sql
CREATE TABLE zando_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) UNIQUE,
    balance NUMERIC DEFAULT 0,
    pending_balance NUMERIC DEFAULT 0,
    total_earned NUMERIC DEFAULT 0,
    last_activity_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    type TEXT NOT NULL,  -- earned, pending, voided, expired, redeemed
    amount NUMERIC NOT NULL,
    order_id UUID,
    referral_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES profiles(id),
    referee_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'active',  -- active, completed
    commission_pct NUMERIC DEFAULT 5,
    max_rewarded_orders INTEGER DEFAULT 3,
    rewarded_orders_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE gift_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    code TEXT NOT NULL UNIQUE,
    original_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    points_used NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active',
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE affiliate_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name TEXT NOT NULL,
    min_referrals INTEGER DEFAULT 0,
    commission_pct NUMERIC DEFAULT 0,
    bonus_points NUMERIC DEFAULT 0,
    badge_label TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customer_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name TEXT NOT NULL,
    badge_label TEXT NOT NULL,
    min_orders INTEGER NOT NULL,
    min_spent NUMERIC NOT NULL,
    discount_pct NUMERIC DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.13 Wallet Vendeur

```sql
CREATE TABLE vendor_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) UNIQUE,
    available_balance NUMERIC DEFAULT 0,
    pending_balance NUMERIC DEFAULT 0,
    total_earned NUMERIC DEFAULT 0,
    total_withdrawn NUMERIC DEFAULT 0,
    retention_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vendor_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    type TEXT NOT NULL,  -- credit, release, withdrawal, refund
    amount NUMERIC NOT NULL,
    order_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    amount NUMERIC NOT NULL,
    method TEXT DEFAULT 'mobile_money',
    phone_number TEXT,
    status TEXT DEFAULT 'pending',  -- pending, approved, rejected, paid
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vendor_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) UNIQUE,
    tier TEXT DEFAULT 'beginner',  -- beginner, pro, premium, enterprise
    max_products INTEGER DEFAULT 10,
    is_whatsapp_enabled BOOLEAN DEFAULT FALSE,
    can_self_deliver BOOLEAN DEFAULT FALSE,
    payment_method TEXT,
    paid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vendor_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    store_name TEXT NOT NULL,
    -- ... details d'application
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vendor_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    document_type TEXT,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.14 CMS

```sql
CREATE TABLE cms_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT,
    link TEXT,
    cta TEXT,
    position TEXT DEFAULT 'hero',  -- hero, left, right
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cms_homepage_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key TEXT NOT NULL,
    label TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cms_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    url TEXT DEFAULT '',
    menu_group TEXT DEFAULT 'main',
    sort_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cms_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cms_popups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    image_url TEXT,
    link TEXT,
    link_label TEXT,
    display_frequency TEXT DEFAULT 'once',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.15 Divers

```sql
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC DEFAULT 0,
    min_order_amount NUMERIC,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Coupons vendeurs (table store_coupons dans le schéma existant)

CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency TEXT DEFAULT 'USD',
    target_currency TEXT NOT NULL,
    rate NUMERIC DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}',
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    target_user_id UUID NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE badge_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    requested_tier TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cancellation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    store_id UUID REFERENCES stores(id),
    requested_by UUID NOT NULL,
    reason TEXT DEFAULT '',
    justification TEXT,
    status TEXT DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. LOGIQUE MÉTIER (Triggers → Services Python)

Tous ces triggers DB doivent devenir des **services Python** appelés dans les endpoints FastAPI :

### 3.1 Notifications automatiques

| Événement | Action |
|-----------|--------|
| Nouvelle commande | Notifier l'acheteur |
| Changement statut commande | Notifier l'acheteur + vendeur |
| Livraison assignée | Notifier le rider + acheteur |
| Arrivée au hub (statut "shipped") | Notifier l'acheteur avec choix de livraison |
| Nouveau message | Notifier l'autre partie |
| Retour créé/mis à jour | Notifier acheteur + vendeur |
| Litige créé/mis à jour | Notifier acheteur + vendeur |
| Livraison mise à jour | Notifier rider + acheteur |
| Expédition mise à jour | Notifier le shipper |

### 3.2 Compteurs automatiques

| Table modifiée | Compteur mis à jour |
|----------------|---------------------|
| products INSERT/DELETE | stores.products_count |
| store_followers INSERT/DELETE | stores.followers_count |
| orders (status → delivered) | stores.sales_count |
| reviews INSERT/UPDATE/DELETE | products.rating + products.review_count |
| reviews INSERT | stores.rating (moyenne) |

### 3.3 Wallet vendeur

- À la livraison (order.status → delivered) : crédit automatique de 90% du subtotal dans vendor_wallets.pending_balance
- CRON quotidien : `release_vendor_pending_funds()` → après N jours de rétention, transférer pending → available
- Commission plateforme : 10%

### 3.4 Points de fidélité (parrainage)

- Nouvelle commande par filleul → points pending pour le parrain
- Commande livrée → pending → earned (finalisés)
- Commande annulée → voided
- CRON : `expire_inactive_points(12)` → expirer après 12 mois d'inactivité

### 3.5 Stock

- À chaque order_item créé → décrémenter `products.stock_quantity`

### 3.6 Historique commandes

- Chaque changement de statut → INSERT dans `order_status_history`

---

## 4. ENDPOINTS API REQUIS

### 4.1 Auth

```
POST   /api/auth/register          # Inscription (email + password)
POST   /api/auth/login              # Login → JWT access + refresh tokens
POST   /api/auth/logout             # Invalider le refresh token
POST   /api/auth/refresh            # Renouveler l'access token
POST   /api/auth/forgot-password    # Envoyer email de reset
POST   /api/auth/reset-password     # Réinitialiser le mot de passe
GET    /api/auth/verify-email/:token # Vérifier l'email
GET    /api/auth/me                 # Profil de l'utilisateur courant
```

### 4.2 Produits

```
GET    /api/products                # Liste avec filtres (category, sale, limit, offset, sort)
GET    /api/products/:id            # Détail produit + store + images + sizes + colors + tiers
GET    /api/products/:id/reviews    # Avis du produit
GET    /api/products/:id/rating-summary  # Résumé des notes
GET    /api/products/:id/pricing-tiers   # Paliers de prix
POST   /api/products/:id/reviews    # Ajouter un avis (auth)
POST   /api/products/:id/reviews/:reviewId/helpful  # Utile +1
```

### 4.3 Catégories

```
GET    /api/categories              # Liste avec sous-catégories
GET    /api/categories/:slug/products  # Produits d'une catégorie
```

### 4.4 Boutiques

```
GET    /api/stores/:id              # Détail boutique
GET    /api/stores/:id/products     # Produits de la boutique
GET    /api/stores/:id/reviews      # Avis boutique
POST   /api/stores/:id/follow       # Suivre/ne plus suivre (auth)
POST   /api/stores/:id/reviews      # Ajouter avis boutique (auth)
```

### 4.5 Panier

```
GET    /api/cart                    # Panier de l'utilisateur (auth)
POST   /api/cart                    # Ajouter un article
PUT    /api/cart/:itemId            # Modifier quantité
DELETE /api/cart/:itemId            # Supprimer un article
DELETE /api/cart                    # Vider le panier
```

### 4.6 Commandes

```
POST   /api/orders                  # Créer une commande (auth)
GET    /api/orders                  # Mes commandes (auth)
GET    /api/orders/:id              # Détail commande (auth)
PUT    /api/orders/:id/delivery-choice  # Choisir livraison domicile/hub
POST   /api/orders/:id/cancel       # Demande d'annulation
```

### 4.7 Paiements (KelPay Mobile Money)

```
POST   /api/payments/initiate       # Lancer un paiement KelPay
POST   /api/payments/callback       # Webhook KelPay (pas d'auth)
POST   /api/payments/check          # Vérifier statut transaction
```

**Logique KelPay :**
- URL de paiement : `https://pay.keccel.com/kelpay/v1/payment.asp`
- URL de vérification : `https://pay.keccel.com/kelpay/v1/checktransaction.asp`
- Auth : `Bearer {KELPAY_TOKEN}`
- Body : `merchantcode`, `mobilenumber` (format 0XXXXXXXXX ou 243XXXXXXXXX), `reference`, `amount`, `currency`, `description`, `callbackurl`
- Réponse : `code: "0"` = succès, sinon échec
- Callback : `{ code, reference, transactionid, description }`

### 4.8 Shipping

```
POST   /api/shipping/calculate      # Calculer les frais de port
GET    /api/shipping/zones           # Liste des zones
GET    /api/cities                   # Liste des villes (avec autocomplete)
```

**Logique de calcul shipping :**
1. Trouver les villes origin + destination
2. Calculer la distance (haversine)
3. Trouver la route (origin_zone → destination_zone + mode)
4. Si pas de route → utiliser shipping_defaults
5. Calculer : base_price = rate × quantité (selon rate_unit: kg/cbm/km/unit)
6. Appliquer min_charge + fuel_surcharge_pct
7. Retourner total avec transit_days

### 4.9 Addresses sauvegardées

```
GET    /api/addresses               # Mes adresses (auth)
POST   /api/addresses               # Ajouter
PUT    /api/addresses/:id           # Modifier
DELETE /api/addresses/:id           # Supprimer
```

### 4.10 Messagerie

```
GET    /api/conversations           # Mes conversations (auth)
GET    /api/conversations/:id/messages  # Messages d'une conversation
POST   /api/conversations           # Créer une conversation
POST   /api/conversations/:id/messages  # Envoyer un message
PUT    /api/messages/:id/read       # Marquer comme lu
```

### 4.11 Notifications

```
GET    /api/notifications           # Mes notifications (auth)
PUT    /api/notifications/:id/read  # Marquer comme lue
PUT    /api/notifications/read-all  # Tout marquer comme lu
GET    /api/notifications/unread-count  # Nombre non lues
```

### 4.12 Fidélité & Parrainage

```
GET    /api/loyalty/points          # Mon solde de points (auth)
GET    /api/loyalty/transactions    # Historique des transactions
POST   /api/loyalty/redeem          # Échanger des points (gift card)
GET    /api/loyalty/referral-code   # Mon code de parrainage
GET    /api/loyalty/referrals       # Mes filleuls
GET    /api/loyalty/tier            # Mon tier client
```

### 4.13 Wishlist

```
GET    /api/wishlist                # Ma liste de souhaits (auth)
POST   /api/wishlist                # Ajouter un produit
DELETE /api/wishlist/:productId     # Retirer
```

### 4.14 Retours & Litiges

```
POST   /api/returns                 # Créer une demande de retour (auth)
GET    /api/returns                 # Mes retours (auth)
POST   /api/disputes                # Créer un litige (auth)
GET    /api/disputes                # Mes litiges (auth)
GET    /api/disputes/:id/messages   # Messages du litige
POST   /api/disputes/:id/messages   # Ajouter un message
```

### 4.15 Suivi

```
GET    /api/tracking/shipment/:awb  # Suivre une expédition
GET    /api/tracking/delivery/:ref  # Suivre une livraison
GET    /api/tracking/rider/:deliveryId  # Position du rider (realtime)
```

### 4.16 CMS (public)

```
GET    /api/cms/banners             # Bannières actives
GET    /api/cms/sections            # Sections homepage
GET    /api/cms/menu                # Menu items
GET    /api/cms/pages/:slug         # Page CMS
GET    /api/cms/popups              # Popups actifs
```

### 4.17 Coupons

```
POST   /api/coupons/validate        # Valider un code promo
```

### 4.18 Exchange Rates

```
GET    /api/exchange-rates          # Taux de change
```

### 4.19 Recherche

```
GET    /api/search?q=xxx            # Recherche produits (full-text PostgreSQL)
GET    /api/search/suggest?q=xxx    # Suggestions de recherche
```

### 4.20 Factures

```
POST   /api/invoices/generate       # Générer une facture HTML/PDF (auth)
```

### 4.21 Emails

```
POST   /api/emails/send             # Envoyer un email (interne/admin)
```

---

## 5. ENDPOINTS VENDEUR (rôle: vendor)

```
GET    /api/vendor/store            # Ma boutique
PUT    /api/vendor/store            # Modifier ma boutique
GET    /api/vendor/products         # Mes produits
POST   /api/vendor/products         # Ajouter un produit
PUT    /api/vendor/products/:id     # Modifier un produit
DELETE /api/vendor/products/:id     # Supprimer un produit
GET    /api/vendor/orders           # Commandes de ma boutique
PUT    /api/vendor/orders/:id/status  # Changer statut commande
GET    /api/vendor/wallet           # Mon wallet
POST   /api/vendor/wallet/withdraw  # Demande de retrait
GET    /api/vendor/stats            # Statistiques
GET    /api/vendor/coupons          # Mes coupons
POST   /api/vendor/coupons          # Créer un coupon
GET    /api/vendor/returns          # Retours de ma boutique
GET    /api/vendor/disputes         # Litiges de ma boutique
GET    /api/vendor/subscription     # Mon abonnement
```

---

## 6. ENDPOINTS SHIPPER (rôle: shipper)

```
GET    /api/shipper/shipments       # Mes expéditions
POST   /api/shipper/shipments       # Créer une expédition
PUT    /api/shipper/shipments/:id   # Modifier statut
```

---

## 7. ENDPOINTS RIDER (rôle: rider)

```
GET    /api/rider/deliveries        # Mes livraisons
PUT    /api/rider/deliveries/:id/status  # Changer statut + proof
POST   /api/rider/location          # Mettre à jour ma position GPS
```

---

## 8. ENDPOINTS ADMIN (rôle: admin)

```
# Dashboard
GET    /api/admin/dashboard         # Stats globales

# Users
GET    /api/admin/users             # Liste utilisateurs
GET    /api/admin/users/:id         # Détail utilisateur
POST   /api/admin/users/:id/ban     # Bannir
POST   /api/admin/users/:id/unban   # Débannir
POST   /api/admin/users/:id/reset-password  # Reset password
POST   /api/admin/users/:id/roles   # Ajouter/retirer un rôle

# Orders
GET    /api/admin/orders            # Toutes les commandes
PUT    /api/admin/orders/:id/status # Forcer un statut

# Categories
GET    /api/admin/categories        # CRUD catégories
POST   /api/admin/categories
PUT    /api/admin/categories/:id
DELETE /api/admin/categories/:id

# CMS
GET/POST/PUT/DELETE /api/admin/cms/banners
GET/POST/PUT/DELETE /api/admin/cms/sections
GET/POST/PUT/DELETE /api/admin/cms/pages
GET/POST/PUT/DELETE /api/admin/cms/popups
GET/POST/PUT/DELETE /api/admin/cms/menu

# Coupons
GET/POST/PUT/DELETE /api/admin/coupons

# Shipping
GET/POST/PUT/DELETE /api/admin/shipping/zones
GET/POST/PUT/DELETE /api/admin/shipping/routes
GET/POST/PUT/DELETE /api/admin/shipping/defaults
GET/POST/PUT/DELETE /api/admin/cities

# Settings
GET/PUT /api/admin/settings/:key

# Withdrawals
GET    /api/admin/withdrawals
PUT    /api/admin/withdrawals/:id   # Approuver/rejeter

# Returns & Disputes
GET    /api/admin/returns
PUT    /api/admin/returns/:id
GET    /api/admin/disputes
PUT    /api/admin/disputes/:id

# Vendor Applications
GET    /api/admin/vendor-applications
PUT    /api/admin/vendor-applications/:id  # Approuver/rejeter

# Exchange Rates
GET/PUT /api/admin/exchange-rates

# Audit
GET    /api/admin/audit-logs

# SEO
GET/PUT /api/admin/seo

# Notifications push (admin broadcast)
POST   /api/admin/notifications/push

# Points admin
GET    /api/admin/points/summary
POST   /api/admin/points/expire     # Lancer l'expiration
```

---

## 9. STORAGE (Upload de fichiers)

Utiliser un répertoire local ou MinIO/S3 pour stocker les fichiers :

| Bucket | Public | Usage |
|--------|--------|-------|
| product-media | Oui | Images/vidéos produits |
| review-images | Oui | Images des avis |
| delivery-proofs | Oui | Photos de preuve de livraison |
| chat-media | Oui | Fichiers de messagerie |
| vendor-documents | Non | Documents vendeurs (privé) |
| cms-assets | Oui | Assets CMS (bannières, etc.) |

```
POST   /api/upload/:bucket          # Upload un fichier
GET    /api/media/:bucket/:filename # Servir un fichier
```

---

## 10. TÂCHES CRON (Celery)

| Tâche | Fréquence | Description |
|-------|-----------|-------------|
| `release_vendor_pending_funds` | Quotidien 02:00 | Libérer les fonds vendeurs après rétention |
| `expire_inactive_points` | Hebdomadaire dim 03:00 | Expirer les points après 12 mois |
| `notify_expiring_points` | Hebdomadaire lun 09:00 | Avertir les utilisateurs dont les points vont expirer |
| `pg_dump_backup` | Quotidien 04:00 | Backup PostgreSQL + rotation 7 jours |
| `generate_sitemap` | Hebdomadaire | Régénérer le sitemap XML |

---

## 11. SECRETS / VARIABLES D'ENVIRONNEMENT

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/zandofy
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-jwt-secret-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM_EMAIL=noreply@zandofy.com
KELPAY_MERCHANT_CODE=your-merchant-code
KELPAY_TOKEN=your-kelpay-token
CORS_ORIGINS=https://zandofy.com,http://localhost:5173
MEDIA_PATH=/var/lib/zandofy/media
```

---

## 12. WEBSOCKETS (Realtime)

Le frontend utilise Supabase Realtime pour :
1. **Messages** : Nouvelles messages dans les conversations
2. **Notifications** : Nouvelles notifications en temps réel
3. **Position rider** : Mise à jour GPS du livreur

→ Implémenter avec **FastAPI WebSockets** :

```
WS /api/ws/notifications       # Notifications realtime
WS /api/ws/messages/:convId    # Messages d'une conversation
WS /api/ws/rider-location/:id  # Position GPS du rider
```

---

## 13. STRUCTURE DE PROJET RECOMMANDÉE

```
backend/
├── app/
│   ├── main.py                 # FastAPI app + startup
│   ├── config.py               # Settings (Pydantic BaseSettings)
│   ├── database.py             # SQLAlchemy engine + session
│   ├── models/                 # SQLAlchemy models
│   │   ├── user.py
│   │   ├── store.py
│   │   ├── product.py
│   │   ├── order.py
│   │   ├── payment.py
│   │   ├── shipping.py
│   │   ├── notification.py
│   │   ├── loyalty.py
│   │   ├── cms.py
│   │   └── ...
│   ├── schemas/                # Pydantic request/response schemas
│   ├── routers/                # FastAPI routers
│   │   ├── auth.py
│   │   ├── products.py
│   │   ├── orders.py
│   │   ├── payments.py
│   │   ├── vendor.py
│   │   ├── admin.py
│   │   ├── shipping.py
│   │   └── ...
│   ├── services/               # Business logic
│   │   ├── notification_service.py
│   │   ├── payment_service.py
│   │   ├── shipping_service.py
│   │   ├── loyalty_service.py
│   │   ├── email_service.py
│   │   └── ...
│   ├── middleware/              # Auth, CORS, rate limiting
│   ├── tasks/                  # Celery tasks
│   └── utils/                  # Helpers (haversine, phone normalization, etc.)
├── alembic/                    # Database migrations
├── tests/
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

---

## 14. NOTES IMPORTANTES POUR L'IMPLÉMENTATION

### Sécurité
- **Rôles** : Toujours vérifier les rôles côté serveur via la table `user_roles`. JAMAIS côté client.
- **JWT** : Access token (15 min) + Refresh token (7 jours). Refresh token en httpOnly cookie si possible.
- **Rate limiting** : Appliquer sur les endpoints auth et paiement.
- **Validation** : Utiliser Pydantic pour toutes les entrées.

### Performance
- **Pagination** : Toutes les listes doivent être paginées (limit/offset ou cursor).
- **Index** : Créer des index sur les colonnes fréquemment filtrées.
- **Cache Redis** : Catégories, CMS, exchange rates (TTL 5-15 min).

### Normalisation téléphone (RDC)
```python
def normalize_phone(raw: str) -> str | None:
    digits = re.sub(r'\D', '', raw)
    if digits.startswith('243') and len(digits) == 12:
        return digits
    if digits.startswith('0') and len(digits) == 10:
        return digits
    if not digits.startswith('0') and not digits.startswith('243') and len(digits) == 9:
        return '0' + digits
    return None
```

### Haversine (calcul de distance)
```python
import math

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
```
