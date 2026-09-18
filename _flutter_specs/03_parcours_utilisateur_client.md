# Zandofy Flutter — Parcours utilisateur client

> Source : routes `App.tsx`, pages client, contexts `Auth`, `Cart`, `Wishlist`, `I18n`.
> **Hors scope Flutter V1** : `/admin/*`, `/vendor`, `/operator`, `/forwarder`, `/rider`, `/carrier`, impersonation.

---

## 1. Navigation globale

### 1.1 Structure (équivalent mobile)

| Zone | Web | Flutter recommandé |
|------|-----|-------------------|
| Accueil | `/` | `HomeScreen` |
| Recherche | `/search` | `SearchScreen` |
| Catégorie | `/category/:slug` | `CategoryScreen` |
| Produit | `/product/:slug` | `ProductDetailScreen` |
| Boutique | `/store/:id` | `StoreScreen` |
| Boutiques | `/stores` | `StoresListScreen` |
| Panier | drawer + `/checkout` | `CartScreen` + `CheckoutFlow` |
| Favoris | `/wishlist` | `WishlistScreen` |
| Compte | `/account`, `/dashboard` | `AccountScreen` / `DashboardScreen` |
| Auth | `/auth` | `AuthScreen` |
| Messages | `/messages` | `MessagesScreen` |
| Suivi | `/tracking`, `/tracking/:ref` | `TrackingScreen` |

### 1.2 Bottom navigation (mobile web)

Onglets (`bottomNav.*`) — contrat Alibaba / Jacob (source de vérité : `docs/MOBILE_CHROME_ALIBABA.md`) :

1. **Accueil** → `/` (re-tap → reshuffle feed Tendance)
2. **Catégories** → panneau catégories (event `toggle-mobile-categories`, pas une route)
3. **Messagerie** → `/messages` (guest → `/auth`)
4. **Panier** → ouvre drawer panier
5. **Compte** → `/account` (guest → `/auth`)

Flutter : `NavigationBar` 5 items + badge panier / messages. Favoris et recherche **dans le header**, pas en bas.

### 1.2bis Accueil — marché Local / International

Segmented control sous le hero : `all` | `local` | `international`  
→ filtre `products_public.shop_type` uniquement (découverte). Préférence : `zandofy_home_market`. Ne pas coupler au checkout.

### 1.3 Deep links

| Pattern | Action |
|---------|--------|
| `/product/{slug\|id}` | Ouvrir PDP |
| `/category/{slug}` | Liste catégorie |
| `/store/{id}` | Page boutique |
| `/wishlist/shared/{userId}` | Wishlist partagée (lecture seule) |
| `/payment/return` | Retour paiement KelPay |
| `/auth?mode=signup&ref={code}` | Inscription parrainage |
| `/auth?redirect=/checkout` | Login puis checkout |

---

## 2. Authentification & onboarding

### 2.1 Flux connexion email

1. **Entrée** : header « Compte », panier sans session, favoris, checkout.
2. **Écran** `/auth` mode `login`.
3. Champs : email, mot de passe (toggle visibilité).
4. **Soumission** → `supabase.auth.signInWithPassword`.
5. **Succès** : redirect `?redirect=` ou `/`.
6. **Échec** :
   - Rate limit (`checkRateLimit`) → « Compte temporairement verrouillé. Réessayez dans X minute(s). »
   - Credentials invalides → toast « Erreur » + message Supabase
7. **Google** : `signInWithGoogle()` OAuth.

### 2.2 Flux inscription

1. Mode `signup` (`/auth?mode=signup`).
2. Champs : prénom, nom, email, mot de passe.
3. **Validation mot de passe** : score ≥ 3 (`getPasswordStrength`) — min 8 car., majuscules, chiffres, symboles.
4. **Géo** : si pays détecté non actif → toast « Service indisponible » + option « Me notifier ».
5. `signUp` avec metadata : `first_name`, `last_name`, `referral_code`, `detected_country`, `detected_city`.
6. Si `ref` URL : insert `referrals` (referrer trouvé par `profiles.referral_code`).
7. **Succès** : toast « Inscription réussie ! Vérifiez votre email… »
8. **Email confirmation** : selon config Supabase (peut bloquer login tant que non confirmé).

### 2.3 Mot de passe oublié

1. Mode `forgot`.
2. Email → `resetPasswordForEmail`.
3. Toast « Email envoyé » / limite resets (`checkResetAllowed`).

### 2.4 Reset password

Route `/reset-password` — token email Supabase.

### 2.5 Guards globaux

| Guard | Comportement |
|-------|--------------|
| `BanGuard` | User banni → `/banned` |
| `RecoveryGuard` | Flux recovery auth |
| `MaintenanceGuard` | Mode maintenance plateforme |
| `GeoBlockGuard` | Pays bloqué → écran blocage |

### 2.6 Onboarding

`/onboarding` — premier lancement PWA (préférences, notifications). Optionnel Flutter V1.

---

## 3. Catalogue & découverte

### 3.1 Accueil (`Index`)

Sections typiques :
- Hero bannière (carousel)
- Catégories / mega menu
- Super promo, tendances, « Pour vous », nouveautés
- Grilles produits (`ProductGrid` + `ProductCard`)

**Loading** : `PageLoadingSkeleton` route-level ; skeleton shimmer sur cards.

**Erreurs** : `ErrorBoundary` « Oups » avec reset sur navigation.

### 3.2 Catégorie (`/category/:slug`)

1. Résolution slug → `categories` (name_fr/name).
2. Filtre produits `category_id` (+ enfants si applicable).
3. Tri : pertinence, prix, nouveautés, notes.
4. Grille 2 colonnes mobile.

### 3.3 Liste boutique (`/store/:id`)

- Header logo, bannière, stats (ventes, followers, rating).
- Onglet produits filtrés `store_id`.
- WhatsApp via Edge `get-store-whatsapp` si configuré.

### 3.4 Pages listing spéciales

| Route | Contenu |
|-------|---------|
| `/trends` | Tags tendance |
| `/super-promo` | Produits promo |
| `/popular` | Populaires |
| `/stores` | Annuaire fournisseurs |

---

## 4. Recherche & filtres

### 4.1 Recherche texte (`/search?q=`)

1. Barre header ou page search.
2. **PredictiveSearch** : suggestions live, debounce.
3. Fallback keyword + option **visual-search** (upload image → Edge).

### 4.2 Filtres (`search.*`)

- Catégorie, prix min/max, taille, couleur.
- Tri : `relevance`, `priceAsc`, `priceDesc`, `newest`, `bestRated`.

### 4.3 États UI

| État | Message i18n |
|------|--------------|
| Loading | `search.searching` — « Recherche... » |
| Vide | `search.noResults` / `search.tryOther` |
| Aucun résultat query | `search.noResultsFor` |

---

## 5. Fiche produit (PDP)

### 5.1 Chargement

Route `/product/:slug` — fetch par slug ou id.

**Erreur** : `product.notFound` → « Produit introuvable » + CTA `product.backToHome`.

### 5.2 Contenu

- Galerie images (`ProductGallery`) — swipe, zoom
- Titre : `name_fr` si FR, sinon `name`
- Prix : flash price si actif, original barré
- Variantes : couleur (swatches hex), taille
- MOQ : quantité min à l’ajout panier
- Badges : nouveau, sale, certifié, rank vendeur
- Description, matière, style, origine
- Avis (`ProductReviews`) + RPC rating summary
- Produits similaires
- Estimateur shipping (`calculate-shipping`)

### 5.3 Actions

| Action | Pré-requis | Feedback |
|--------|------------|----------|
| Ajouter panier | Login | Toast succès / drawer ouvert |
| Favoris | Login | Toggle heart ; sinon toast connexion |
| Comparer | — | Compare bar (max N produits) |
| Partager | — | Native share sheet |
| Contacter vendeur | Login | Ouvre conversation |

**Erreur panier sans login** : « Connexion requise » / « Connectez-vous pour ajouter au panier. »

---

## 6. Panier

### 6.1 Source données

Table `cart_items` sync serveur (pas panier local offline V1 web).

### 6.2 Drawer / écran panier

- Liste items : image, nom, variantes, prix, quantité
- Checkbox **sélection** (pour checkout partiel)
- Sous-total sélectionné
- CTA « Commander » → `/checkout`
- État vide : `cart.empty` + `cart.continueShopping`

### 6.3 Actions

| Action | API |
|--------|-----|
| +/- quantité | update `cart_items.quantity` (respect MOQ) |
| Changer variante | update color/size |
| Supprimer | delete row |
| Vider | delete all user cart |

**Loading** : `CartContext.loading` — spinner global drawer.

---

## 7. Favoris (wishlist)

### 7.1 Liste (`/wishlist`)

- Query `wishlists` + join products published.
- Grille produits comme catalogue.
- Partage : lien `/wishlist/shared/{userId}`.

### 7.2 Toggle

- Insert/delete `wishlists`.
- **Sans login** : toast « Connexion requise » / « Veuillez vous connecter pour enregistrer vos favoris ».
- **Erreur API** : « Impossible d'ajouter/retirer des favoris ».

### 7.3 États

| État | Message |
|------|---------|
| Vide | `wishlist.empty` + `wishlist.emptySub` |
| Non connecté | `wishlist.loginRequired` |

---

## 8. Checkout (commande)

### 8.1 Pré-conditions

1. User authentifié — sinon toast `checkout.loginRequired` + redirect `/auth?redirect=/checkout`.
2. Panier non vide — sinon `checkout.emptyCart`.

### 8.2 Étapes (wizard web)

| Step | Contenu |
|------|---------|
| 1. Expédition | Adresse livraison, choix hub vs domicile, calcul shipping |
| 2. Paiement | Mode : carte, Mobile Money, COD, hors plateforme |
| 3. Confirmation | Récap + création commande |

Labels : `checkout.shipping`, `checkout.payment`, `checkout.confirmation`.

### 8.3 Adresses

- Liste `saved_addresses` ou formulaire nouveau.
- Champs requis : prénom, nom, téléphone, adresse, ville, pays.
- Option « Sauvegarder cette adresse » → insert `saved_addresses`.
- **Erreur** : `checkout.requiredField` / `checkout.fillRequired`.

### 8.4 Livraison

- Edge `calculate-shipping` selon poids, zone, choix hub/home.
- **Zone non desservie** : toast « Zone non desservie » + message pays.
- `last_mile_fee` si livraison domicile.

### 8.5 Code promo

1. Saisie code → lookup `coupons`.
2. Erreurs :
   - `checkout.invalidCode` / `invalidCodeDesc`
   - `checkout.expiredCode`
   - `checkout.usedCode`
   - `checkout.minAmount` (montant minimum)
   - `checkout.storeCouponMismatch` (coupon autre boutique)
3. Succès : `checkout.codeApplied`.

### 8.6 Création commande

Insert `orders` + `order_items` depuis lignes panier sélectionnées ; snapshot prix/noms/images.

Champs clés : `order_ref`, `subtotal`, `shipping_cost`, `total`, `payment_method`, `delivery_choice`, adresse shipping snapshot.

### 8.7 Paiement

| Méthode | Flux |
|---------|------|
| **Mobile Money** | `kelpay-payment` → USSD/push → poll `kelpay-check` |
| **Carte** | `keccel-cardpay` → redirect hosted |
| **COD** | Commande `pending` sans paiement immédiat |
| **Hors plateforme** | Commande `awaiting_payment` + upload preuve (dashboard) |

**Erreurs paiement** :
- « Numéro invalide » — Mobile Money
- « La requête de paiement a été refusée » + detail API
- « Impossible de créer la commande »

### 8.8 Post-commande

- Toast `checkout.orderConfirmed` + référence `checkout.orderRef`.
- Vider lignes panier achetées.
- Redirect `/payment/return` ou dashboard commandes.
- Notifications push / email (backend).

---

## 9. Compte & dashboard (`/dashboard`, `/account`)

### 9.1 Hub compte (`/account`)

Liens vers :
- Dashboard, commandes, abonnements, wishlist, messages
- Fidélité, parrainage, litiges, retours
- Profil, adresses, notifications, KYC, sécurité
- **Hors client Flutter** : devenir vendeur/opérateur/transitaire

### 9.2 Dashboard onglets (`dashboard.tab.*`)

| Onglet | Données |
|--------|---------|
| Aperçu | KPI commandes, dépenses |
| Commandes | Liste `orders` filtres actif/livré/annulé |
| Suivi | Timeline statuts + tracking international |
| Retours | `return_requests` |
| Litiges | `disputes` |
| Messages | `conversations` |
| Profil | `profiles` edit |
| Adresses | `saved_addresses` CRUD |
| Notifications | `notifications` |
| KYC | formulaire documents |
| Parrainage / Affiliation | `referrals`, liens |

### 9.3 Détail commande

- Timeline statuts (`STATUS_FLOW` / `LOCAL_STATUS_FLOW`).
- Code confirmation livraison (`confirmation_code`).
- Actions : payer expédition différée, relancer paiement, PDF facture, ouvrir litige.

---

## 10. Messagerie

1. Liste conversations par boutique.
2. Thread messages realtime (Supabase Realtime).
3. Contexte produit optionnel.
4. Pièces jointes si `chat_media_enabled` boutique.

---

## 11. Suivi colis (`/tracking`)

- Recherche par `order_ref` ou `tracking_number`.
- Timeline internationale (`intl.timeline.*`) si fret.
- Pas toujours auth requis (vérifier RLS).

---

## 12. États transverses (loading / erreur / offline)

| Situation | Pattern web | Flutter |
|-----------|-------------|---------|
| Route lazy load | `PageLoadingSkeleton` | `CircularProgressIndicator` + skeleton |
| Query React Query | `isLoading` / `isFetching` | `AsyncValue` / FutureBuilder |
| Erreur réseau | `OfflineIndicator` bannière | `ConnectivityBanner` |
| Erreur API | Toast destructive | `SnackBar` rouge |
| Session expirée | Redirect auth | Refresh token Supabase + re-login |
| Maintenance | `MaintenanceGuard` écran | Écran maintenance |
| Geo bloqué | `GeoBlockScreen` | Écran blocage pays |

### 12.1 Messages d’erreur fréquents (reproduire)

| Contexte | Message FR |
|----------|------------|
| Panier sans login | « Connexion requise » / « Connectez-vous pour ajouter au panier. » |
| Favoris sans login | « Veuillez vous connecter pour enregistrer vos favoris » |
| Checkout sans login | « Connexion requise » + « Connectez-vous pour continuer votre commande. » |
| Auth lockout | « Compte temporairement verrouillé… » |
| MDP faible signup | « Mot de passe trop faible » |
| Pays non actif | « Service indisponible » |
| Zone livraison | « Zone non desservie » |
| Coupon invalide | Clés `checkout.invalidCode*` |
| Paiement MM invalide | « Numéro invalide » |
| Paiement refusé | « La requête de paiement a été refusée » |
| Wishlist API | « Impossible d'ajouter aux favoris » |

---

## 13. Contenus statiques (optionnel V1)

Routes : `/about`, `/faq`, `/help-center`, `/terms`, `/privacy`, `/blog/*`, `/loyalty-program`, `/affiliate-program`.

Peuvent être WebView vers zandofy.com ou écrans natifs avec contenu CMS (`cms_pages` / `platform_settings`).

---

## 14. Priorisation Flutter V1 (recommandée)

**Must have**
- Auth email + Google
- Home, catégories, search, PDP
- Panier, checkout (au moins MM + COD)
- Favoris, compte commandes
- i18n FR/EN + devises

**V2**
- Messages, litiges, retours, KYC
- Recherche visuelle, comparateur
- Parrainage, fidélité
- Push notifications (`push_subscriptions`)
