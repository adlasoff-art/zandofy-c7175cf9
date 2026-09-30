# Zandofy — Handoff Web/PWA → Application native (Flutter / iOS / Android)

**Date :** 2026-09-30  
**Public :** équipe mobile native  
**Source de vérité :** GitHub (`main` / `develop`)  
**Backend :** Supabase (migrations + Edge Functions à la **racine** du repo uniquement)

Ce document décrit les structures et contrats déjà en place sur le **web / PWA** que le natif doit **reprendre et adapter**. Ne pas reinventer les règles métier.

---

## 0. Paquet de docs à lire ensemble

| Fichier | Priorité | Sujet |
|---------|----------|--------|
| **Ce fichier** | P0 | Vue d’ensemble + règles dures |
| `docs/NATIVE_MOBILE_HANDOFF_INDEX.md` | P0 | Liste complète des MD à transmettre |
| `docs/ENVIRONMENTS.md` | P0 | Staging / production |
| `docs/AUTH_SETTINGS.md` | P0 | Modes auth fluid/strict |
| `docs/guides/GEO_COMMERCIAL_SCOPE.md` | P0 | Scope commercial + éligibilité |
| `docs/guides/CHECKOUT_SESSIONS.md` | P0 | 1 paiement → N commandes |
| `docs/OFF_PLATFORM_PAYMENT.md` | P0 | Hors plateforme / WhatsApp |
| `docs/DISCOVERY_MOBILE_HANDOFF.md` | P0 | Discovery (déjà partiel mobile) |
| `docs/I9_MARKETPLACE_MOBILE_SYNC.md` | P1 | Marketplace I9 / samples / RFQ |
| `docs/EDGE_FUNCTIONS_INVENTORY.md` | P1 | Inventaire Edge Functions |
| `docs/ARCHITECTURE-STACK.md` | P1 | Stack globale |
| `docs/DISCOVERY_ENGINE.md` | P2 | Détail algo discovery |
| `docs/PRODUCT_IMAGE_GUIDELINES.md` | P2 | Médias produits |
| `docs/STORE_PUBLIC_VISIBILITY_OPS.md` | P2 | Visibilité boutiques |

**Chemins backend (obligatoire) :**

- `supabase/migrations/` — SQL
- `supabase/functions/` — Edge Functions

**Interdit :** `frontend/supabase/` (legacy, ne plus utiliser).

---

## 1. Stack & environnements

| Couche | Techno |
|--------|--------|
| Web | React + TypeScript + Vite → **Vercel** (`frontend/`) |
| Backend | **Supabase Pro** (Auth, PostgreSQL, Storage, Realtime, Edge) — **2 projets** isolés |
| CDN | Cloudflare (DNS / cache / WAF) |
| PWA | `frontend/public/sw.js`, `frontend/public/manifest.json` |

### Projets Supabase (référence)

| Env | Rôle |
|-----|------|
| Staging | Tests schéma / features |
| Production | Utilisateurs live (~4000+) |

Configurer chaque **flavor** mobile (staging / prod) avec l’URL + **anon / publishable key** du projet correspondant.

### Variables (équivalents natifs)

| Web | Mobile |
|-----|--------|
| `VITE_SUPABASE_URL` | URL projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé **anon** uniquement |
| `VITE_SUPABASE_PROJECT_ID` | Ref projet |
| `VITE_SITE_URL` | Canonical `https://zandofy.com` |

**Jamais** de service role dans l’app native.

### Workflow SQL (humain)

1. Fichier dans `supabase/migrations/`
2. Exécuter en SQL Editor **staging**
3. Smoke (auth, catalogue, checkout, vendeur)
4. **Même fichier** en SQL Editor **production**
5. Déployer Edge Functions staging → prod

---

## 2. Auth (critique — à aligner en premier)

### 2.1 Téléphone → email synthétique

- Domaine interne : `users.zandofy.internal`
- Exemple : `+243812345678` → `243812345678@users.zandofy.internal`
- Référence web : `frontend/src/lib/auth-helpers.ts`
  - `phoneToSyntheticEmail`
  - `parseAuthIdentifier`
  - `isSyntheticAuthEmail`
- **Pas d’OTP SMS** pour les comptes téléphone + mot de passe
- L’utilisateur ne doit **pas** saisir `@users.zandofy.internal`
- Mot de passe oublié : **email réel uniquement**

### 2.2 Login téléphone

1. Edge Function `resolve-auth-identifier` (`verify_jwt: false`)  
   Body : `{ "phone": "..." }` → `{ "email": "..." }`
2. `signInWithPassword({ email, password })`

Normalisation téléphone : défaut CD `243`. Réponses génériques anti-énumération (`invalid_credentials`).

### 2.3 Modes (`platform_settings` clé `auth_settings`)

Voir `docs/AUTH_SETTINGS.md`.

- `mode` : `fluid` (session après signup) vs `strict`
- `magic_link_enabled` (souvent `false`)
- Autres flags : gate checkout email, discovery, etc.
- Lecture publique : migration `20260919140000_auth_settings_public_read.sql`

### 2.4 Soft-delete & ban

Migration : `20260927120000_profiles_soft_delete_and_auth_sign_in.sql`

| Colonne | Rôle |
|---------|------|
| `profiles.deleted_at` | Soft-delete |
| `profiles.auth_last_sign_in_at` | Dernière connexion Auth |
| `profiles.email_is_placeholder` | Compte guest / phone |

- Soft-delete = **ban Auth** + email **toujours réservé**
- Hard-delete admin = libère l’email (réinscription possible)
- Edge : `admin-users` (`soft_delete_user`, `restore_user`, `delete_user`, `ban_user`, …)

### 2.5 Invité (guest)

- Panier / wishlist locaux → **merge au login**
- Auth surtout obligatoire au **checkout**
- Bannière soft profil (non bloquante pour naviguer) :
  - email réel / vérif email / adresse (`saved_addresses` vide) / KYC
- Référence : `frontend/src/components/ProfileCompletionBanner.tsx`  
  Priorité gaps : `need_email` → `need_verify` → `need_address` → `need_kyc`

**Adresse :** ne déclencher `need_address` que si **aucun** `saved_addresses` (pas seulement `residence_country` vide).

---

## 3. Branding & assets

| Asset | Chemin web |
|-------|------------|
| Logo marque (Z vert / sac) | `frontend/public/brand/zandofy-logo.webp` → URL `/brand/zandofy-logo.webp` |
| Icônes PWA | `/icons/icon-192.png`, `/icons/icon-512.png` |
| Composant | `frontend/src/components/BrandLogo.tsx` (`DEFAULT_BRAND_LOGO`) |

CMS (via bootstrap branding) : `header_logo_url`, `footer_logo_url`, `logo_mode`, `pwa_icon_192_url`, `pwa_icon_512_url`.

**Règle actuelle web :** logo shippé **en priorité** ; CMS en secours.  
**Ne pas** remplacer le logo marque par l’icône PWA.

Manifest : thème `#1a5c2e`, `start_url: /?source=pwa`. Wordmark : police **Outfit**.

---

## 4. Discovery & catalogue public

Détail : `docs/DISCOVERY_MOBILE_HANDOFF.md`, `docs/DISCOVERY_ENGINE.md`.

| Élément | Contrat |
|---------|---------|
| Prefs | `profiles.discovery_prefs` (+ `home_country_code`, `home_city_id`) |
| RPC | `set_own_discovery_prefs(p_prefs jsonb)` |
| CMS mix | `auth_settings.discovery_*`, `discovery_mix` |
| Catalogue | Vues **`products_public`**, **`stores_public`** |

Les vues publiques masquent boutiques `is_banned` / `is_suspended` / `deleted_at` (`store_is_publicly_visible`).

**Ne pas** exposer le catalogue client via tables brutes `products` / `stores` si les vues publiques existent.

---

## 5. Geo / commercial scope (lot critique)

Doc détaillée : `docs/guides/GEO_COMMERCIAL_SCOPE.md`  
Migrations : `20260926130000` → `20260926139000`.

| Concept | Où | Valeurs |
|---------|-----|---------|
| Type ops | `stores.shop_type` | `local` \| `international` |
| Scope vente défaut | `stores.default_commercial_scope` | `city` \| `country` \| `international` (défaut SQL **`country`**) |
| Override produit | `products.commercial_scope` | `inherit` \| `city` \| `country` \| `international` \| `custom` |
| Destinations | `store_shipping_destinations` (+ twin produit) | `country_code` ISO-2 |
| Modes villes | `*_destination_cities` | `whole_country` \| `selected_cities` \| **`except_cities`** |
| Relation commande | `orders.geo_relation` | `same_city` \| `same_country_other_city` \| `cross_border` |
| Ville livraison | `orders.shipping_city_id` | FK `cities` |
| Flag soft/hard | `platform_settings.geo_eligibility_enforced` | défaut **`false`** |

### RPCs à appeler

- `product_eligible_for_destination(p_product_id, p_country_code, p_city_id)`
- `products_eligible_for_destination(...)` (batch)
- `product_effective_commercial_scope(product_id)`
- `geo_destination_city_allowed(mode, destination_id, city_id)`
- `geo_eligibility_is_enforced()`

### Comportement

| Flag | Effet |
|------|--------|
| **off** | RPC renvoie `eligible: true` (mais `relation` renseignée) |
| **on** | Filtrer feed + checkout fail-closed ; surface d’erreur `GEO_ELIGIBILITY` |

**Ne pas confondre** `shop_type` (ops / KYB) et `default_commercial_scope` (où l’on vend).  
Forwarders plateforme : **mêmes règles de couverture** — pas d’exemption geo.

---

## 6. KYC (acheteur) & KYB (vendeur)

### 6.1 KYC client

- Table : `kyc_verifications`
- Settings : `platform_settings.kyc_settings`
  - `kyc_activation_orders` (~2) → bannière soft
  - `kyc_order_limit` (~10) → **hard block** commandes si non approuvé
- Hook web : `frontend/src/hooks/use-kyc.ts`
- Fail-open si erreur de fetch status (comme le web)

### 6.2 KYB vendeur

- RPC : `store_kyb_gate(p_store_id)`  
  Retour : `{ exempt, required, blocked, soft_warn, shop_type, gmv, threshold, kyb_status }`
- Settings : `platform_settings.kyb_settings`  
  Seuils typiques USD : local **200** / international **500** ; `soft_warn_ratio` ~0.8
- Table : `kyb_submissions`
- **`stores.is_platform_owned = true` → `exempt: true`**
- Triggers serveur : blocage écritures produits / retraits si `blocked`
- Authz : owner / collaborateur actif / admin / manager (sinon `forbidden`)
- Hook web : `frontend/src/hooks/use-store-kyb-gate.ts`  
  - Fonction absente → fail-open  
  - Autre erreur → fail-closed écritures

---

## 7. Vendeur, publication, boutique plateforme

### 7.1 `stores.is_platform_owned`

**Exempté de :**

- Gate « identité boutique » avant publication (logo, bannière, pays, WhatsApp)
- KYB au seuil GMV
- Checklist soft onboarding identité (web)

**Non exempté de :**

- Quotas photos / textes
- Modération `pending_approval`
- Règles freight / couverture
- Release admin pour paiements hors plateforme

Référence web : `assertStoreIdentityReady` dans  
`frontend/src/components/VendorProductManager.tsx`

Ordre de décision :

1. Prop / état dashboard `knownPlatformOwned === true` → OK  
2. Lecture `stores` (`is_platform_owned` + champs identité)  
3. Fallback `stores_public` (collaborateurs souvent sans SELECT complet sur `stores`)  
4. Si `is_platform_owned` → OK  
5. Sinon exiger logo + bannière + pays ; WhatsApp seulement si colonne présente sur la ligne

Commits de référence : `f63a44e2`, `278fd471`, `3d5abcc1`.

### 7.2 Règles de publication produit

| Règle | Valeur |
|-------|--------|
| Photos fixes (hors vidéo) | min **1**, max **5** |
| Description courte | ≥ **15 mots** |
| Description longue | ≥ **200 caractères** |
| Flux statut | `draft` → `pending_approval` → `published` |
| Édition d’un publié | repasse en `pending_approval` |
| Galerie | RPC `sync_product_gallery(product_id, jsonb)` — URLs bucket `product-media` |

Migration gallery / RLS collab : `20260912140000_product_gallery_sync_rpc_and_rls.sql`.

### 7.3 Collaborateurs

- Table : `store_collaborators` (`status = 'active'`, `permissions[]`, `sub_role`)
- Lecture boutique équipe : préférer **`stores_public`**
- Destinations shipping : RLS collab `20260926138000_geo_destinations_collaborator_rls.sql`
- Paiements vendeur : RPC `vendor_update_payment_modes` (owner **ou** collab actif)

### 7.4 Candidature vendeur

- Trigger `enforce_vendor_application_kyc` : KYC **approuvé** requis avant `submitted`
- Multi-boutique : 3 mois + 10 ventes, **sauf** si l’utilisateur a déjà une boutique `is_platform_owned`

---

## 8. Checkout, paiements, freight

### 8.1 Sessions multi-boutiques

Doc : `docs/guides/CHECKOUT_SESSIONS.md`  
Migrations : `20260924160000` → `20260924180000`.

- Tables : `checkout_sessions`, `orders.checkout_session_id`
- Policy : `stores.group_checkout_policy` ∈ `solo_only` \| `own_stores_only` \| `multi_vendor_ok` (défaut multi)
- **Le client ne doit PAS faire d’UPDATE** sur `checkout_sessions`
- Confirmation : `confirm_checkout_session_payment` (Edge / service_role uniquement)
- Échec : `fail_checkout_session_payment`
- Compat groupe : `get_checkout_group_compat`
- Mix paiement différé + online dans un panier → `MIXED_PAYMENT_MODEL` (**interdit**)

### 8.2 Flags & méthodes de paiement

- Overrides : `vendor_pricing_overrides.vendor_*_enabled` (mm, card, off_platform, whatsapp, cod, …)
- RPC :
  - `get_checkout_vendor_payment_flags`
  - `get_checkout_off_platform_numbers`
  - `get_checkout_whatsapp_allowed`
  - `vendor_update_payment_modes`
- Numéros : `store_payment_numbers`
- Wallet :
  - `debit_customer_wallet_for_order`
  - `refund_customer_wallet_for_order`
  - **Pas** pour off_platform / whatsapp / COD

### 8.3 Hors plateforme / WhatsApp (différé)

Doc : `docs/OFF_PLATFORM_PAYMENT.md`  
Helpers web : `frontend/src/lib/off-platform-payment.ts`

1. Statut `awaiting_payment`
2. Upload preuve paiement
3. Vérification vendeur (`off_platform_vendor_verified_*`)
4. Si boutique **`is_platform_owned`** → **release admin** obligatoire (`off_platform_admin_released_*`)
5. Expire ~24h : Edge `expire-pending-orders`

Buckets preuves : `delivery-proofs` / chemins `payment-proofs/{order_id}/…`  
Les `awaiting_payment` MoMo/carte restent **hors** liste vendeur (pipeline différent).

### 8.4 Freight

- Lock `freight_quotes` avant création des commandes
- Champs : `orders.freight_quote_id`, `orders.shipping_cost`
- RPC : `get_eligible_forwarders_v2`
- Edge : `calculate-shipping`
- Client web : `frontend/src/services/freightQuoteCheckout.ts`

### 8.5 Edge paiements (client)

| Fonction | Rôle |
|----------|------|
| `kelpay-payment` / `kelpay-check` / `kelpay-webhook` / `kelpay-callback` | Mobile Money |
| `keccel-cardpay` | Carte |
| `pawapay-payment` / `pawapay-check` / `pawapay-webhook` | Multi-pays (préparation) |
| `mark-payment-abandoned` | Abandon checkout |

---

## 9. Edge Functions — priorités mobile

Inventaire complet : `docs/EDGE_FUNCTIONS_INVENTORY.md`.  
Déploiement : **`supabase/functions/`** racine uniquement.

| Fonction | Usage mobile |
|----------|----------------|
| `resolve-auth-identifier` | Login téléphone |
| `platform-bootstrap` | Settings / branding |
| `calculate-shipping` | Devis livraison |
| `kelpay-*` / `keccel-cardpay` / `pawapay-*` | Paiements |
| `expire-pending-orders` | Expiry paiements différés |
| `get-store-whatsapp` | Numéro WhatsApp boutique |
| `push-notifications` / `notify-app-update` | Push / MAJ app |
| `visual-search` / `index-product-image` | Recherche visuelle |
| `verify-confirmation-code` | Codes confirmation livraison |
| `generate-invoice` | Facture commande livrée |
| `share-proxy` | Partage |
| `ai-recommendations` | Recos |

Ops (pas dans l’app client) : `admin-users`, `impersonate-user`, suite opérateurs / transitaires.

---

## 10. Tables & RPC — mémo mobile

### Catalogue / compte

- `products_public`, `stores_public`, `product_images`, `categories`, `cities`
- `profiles`, `saved_addresses`, `cart_items`, `wishlists`
- `orders`, `order_items`, `order_status_history`, `payment_transactions`, `checkout_sessions`
- `kyc_verifications`, `kyb_submissions`
- `customer_wallets` / transactions
- `store_collaborators`, `vendor_applications`
- `store_shipping_destinations*`, `product_shipping_destinations*`
- `freight_quotes`, `forwarders`
- `platform_settings`, `analytics_events`

### RPC utiles

| RPC | Usage |
|-----|--------|
| `set_own_discovery_prefs` | Onboarding goûts |
| `product_eligible_for_destination` (+ batch) | Geo |
| `store_kyb_gate` | Gate vendeur |
| `sync_product_gallery` | Médias vendeur |
| `debit_customer_wallet_for_order` | Wallet checkout |
| `get_checkout_*` / `confirm_checkout_session_payment` | Sessions |
| `vendor_update_payment_modes` | Réglages paiements vendeur |
| `get_eligible_forwarders_v2` | Freight |
| `get_customer_order_shortcut_counts` | Rails dashboard |
| `get_category_top_sellers` | Top boutiques |
| `match_products_by_image` | Visual search |

---

## 11. Migrations Sept 2026 — backlog contrats

Tous sous `supabase/migrations/`. Thèmes :

| Thème | Préfixes fichiers |
|-------|-------------------|
| Auth / discovery | `2026091912*`, `1914*`, `2020*`, `2101*`, `2115*`, `2118*`, `2712*` |
| Geo commercial | `20260926130000` → `26139000` |
| Checkout sessions | `24160000` → `24180000` |
| KYB / vendor | `16140000`, `16160000`, `24140000`, `24150000` |
| Visibilité boutiques | `14120000`, `16120000` |
| WhatsApp checkout | `21200000` |
| Gallery | `12140000` |
| Wallets / preuves | `2018*` → `20197*` |
| Marketplace I9 | `20260903120000_*` |
| Admin analytics | `20260927205000_*` (admin only) |

---

## 12. Checklist d’implémentation native (ordre)

1. Flavors env staging/prod + clé anon  
2. Auth téléphone synthétique + `resolve-auth-identifier` + soft-delete  
3. Catalogue `*_public` + discovery prefs  
4. Geo home + RPC éligibilité (même si flag off)  
5. Checkout sessions + flags paiement + wallet  
6. Off-platform / WhatsApp + release admin si plateforme  
7. Freight quotes + forwarders  
8. (Si app vendeur) identité exempt plateforme, KYB, gallery, quotas médias  
9. Branding asset logo Z  
10. Push / notify-app-update  

---

## 13. Anti-patterns

| Ne pas faire | Faire à la place |
|--------------|------------------|
| Service role dans le binaire | Anon + Edge / RPC |
| UPDATE client de `checkout_sessions` | Edge / RPC confirm |
| Hard-block browse pour email/adresse manquants | Soft banner |
| SELECT collab sur toute la table `stores` | `stores_public` |
| Exempter forwarders plateforme du geo | Mêmes règles |
| Confondre `shop_type` et `commercial_scope` | Deux concepts distincts |
| Soft-delete = email libre | Soft-delete = ban + email réservé |
| Déployer depuis `frontend/supabase/` | Racine `supabase/` |

---

## 14. Fichiers web de référence (miroir)

| Sujet | Chemin |
|-------|--------|
| Auth helpers | `frontend/src/lib/auth-helpers.ts` |
| Logo | `frontend/src/components/BrandLogo.tsx` |
| Publish / identité | `frontend/src/components/VendorProductManager.tsx` |
| Off-platform | `frontend/src/lib/off-platform-payment.ts` |
| Freight checkout | `frontend/src/services/freightQuoteCheckout.ts` |
| KYB | `frontend/src/hooks/use-store-kyb-gate.ts` |
| KYC | `frontend/src/hooks/use-kyc.ts` |
| Banner profil | `frontend/src/components/ProfileCompletionBanner.tsx` |
| Discovery prefs | `frontend/src/lib/discovery-prefs.ts` |
| Order status / geo | `frontend/src/lib/order-status.ts` |

---

## 15. Smoke tests suggérés (mobile)

- [ ] Login téléphone + login email  
- [ ] Guest cart → login merge  
- [ ] Soft banner adresse uniquement si 0 `saved_addresses`  
- [ ] Catalogue `products_public` (boutique bannie absente)  
- [ ] Discovery prefs persistées via RPC  
- [ ] `product_eligible_for_destination` (flag off puis on)  
- [ ] Checkout 1 session multi-boutiques (si policy ok)  
- [ ] MoMo / carte / wallet  
- [ ] WhatsApp / off_platform : awaiting → preuve → vérif (admin si plateforme)  
- [ ] Compte soft-deleted : login impossible  
- [ ] (Vendeur) boutique `is_platform_owned` : publish sans identité complète  
- [ ] (Vendeur) boutique indépendante : identité + photos + textes exigés  

---

**Fin du handoff principal.**  
Index des fichiers à transmettre : `docs/NATIVE_MOBILE_HANDOFF_INDEX.md`.
