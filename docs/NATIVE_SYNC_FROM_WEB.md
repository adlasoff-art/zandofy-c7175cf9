# Sync native — 2026-10-01 — lot fiabilisation + contrats PWA

**Public :** agent Cursor / équipe **Flutter `zandofy-mobile`**  
**Auteur :** web PWA (`frontend/` + `supabase/` monorepo)  
**Contexte :** migrations `20261001140000` → `20261001162000` appliquées staging ; fiabilisation R0–R5 + audit hotfixes.  
**Backend unique :** `supabase/` à la racine du monorepo web — **jamais** `frontend/supabase/` (supprimé).

> Règles mobiles à respecter : JWT/anon only ; catalogue `*_public` ; pas d’UPDATE client sur `checkout_sessions` ; hide-if-fail via `BackendCapabilityProbe`.

---

## Sync native — 2026-10-01 — lot reliability + FOURNIR P0–P4

### Changements web de ce lot (résumé)

- Entitlements lecture via `get_store_entitlements` ; miroirs legacy en écriture admin
- Checkout : lanes `fulfillment_lane`, crédit Enterprise preview/consume, allowlists carriers, last-mile gate
- KYB : rescore docs + gate submit serveur score≥80 + 5 docs
- PWA SW v13 : navigate **network-first** (plus de cache HTML long)
- Dead trees : `frontend/supabase/`, `src/integrations/`, `logistics-path.ts` retirés
- Docs : `VENDOR_PLANS_AND_FULFILLMENT_CONTRACT.md` §8 Contract RPC, `OPS_RUNBOOK_RELIABILITY.md`, `CHECKOUT_SMOKE_CHECKLIST.md`

### Contrats SQL / RPC / Edge (noms + migrations)

| Contrat | Migration / lieu | Auth | Notes mobile |
|---------|------------------|------|--------------|
| `get_store_entitlements` | `142000` + `150000` + `155000` | authenticated (owner/collab/admin) | Features + quotas |
| `get_checkout_vendor_payment_flags` | `150000` / `155000` | anon + auth | Modes paiement checkout |
| `preview_included_delivery_credit` | `161000` | anon + auth | Preview only — **pas** consume |
| `try_consume_included_delivery` | `151000` + `155000` + **`162000`** | auth buyer/staff ou service_role | Après insert `order_items` ; ajuste `total` si crédit |
| `get_carrier_allowlist_ids` | `153000` | anon + auth | `null` = pas de filtre |
| `refresh_kyb_completeness_score` | `160000` + **`162000`** | authenticated store team | Après upload KYB |
| `assert_store_identity_ready` | `140000` | owner/collab | Gate publish |
| `store_kyb_gate` | existant | store team | soft_warn / blocked |
| Edge `accrue-hub-storage` | `supabase/functions/accrue-hub-storage/` | cron secret / service_role | Ops only |

Détail signatures : [`docs/VENDOR_PLANS_AND_FULFILLMENT_CONTRACT.md`](./VENDOR_PLANS_AND_FULFILLMENT_CONTRACT.md) §8.

### Chemins composants UI PWA

Voir sections **FOURNIR** ci-dessous (§3.1–3.4).

### Impact attendu mobile

- [x] Chrome — mapping routes & guest rules (§3.1)
- [x] Zones géo — schéma + picker (§3.3) **BLOQUANT**
- [x] Checkout / freight — payloads + shipping payment (§3.4)
- [x] Affichage poids kg (§3.2)
- [ ] Auth — inchangé ce lot
- [ ] Discovery — inchangé ce lot (prefs déjà OK)
- [x] Entitlements / KYB / included delivery — nouveaux RPC à probe

### Breaking ?

**Non** pour clients existants si migrations déjà appliquées.  
**Oui** si mobile appellait encore des chemins `frontend/supabase` (supprimés).  
KYB submit client-only sans score/docs → **rejeté serveur** (`kyb_incomplete_*`).

---

## 3.1 Chrome & IA (PWA référence) — FOURNIR

### Chemins composants

| Surface | Chemin |
|---------|--------|
| Header (top bar promo + logo + cloche + tracking + wishlist + search sticky mobile) | `frontend/src/components/Header.tsx` |
| Brand logo CMS-first | `frontend/src/components/BrandLogo.tsx` |
| Bottom nav mobile | `frontend/src/components/MobileBottomNav.tsx` |
| Hide rules bottom nav | `frontend/src/lib/mobile-chrome.ts` |
| Filtres Tout / Local / International | `frontend/src/components/HomeMarketSwitch.tsx` + `frontend/src/contexts/HomeMarketContext.tsx` |
| Home compose | `frontend/src/pages/Index.tsx` |
| Annonces popup (≠ top bar) | `frontend/src/components/AnnouncementPopup.tsx` |

### Routes exactes

| Action PWA | Route / comportement |
|------------|----------------------|
| Accueil | `/` |
| Catégories (bottom) | **pas une route** — event `toggle-mobile-categories` → panel Header / MegaMenu |
| Messagerie | `/dashboard?tab=messages` (guest → redirect auth) ; aussi `/messages` |
| Panier | Drawer cart (`useCart().setDrawerOpen`) — path `#cart` |
| Compte | `/account` |
| Favoris | `/wishlist` |
| Suivi commande | `/tracking` et `/tracking/:ref` |
| Notifications / espace | `/dashboard` (Bell) |
| Search | sticky dans Header (mobile) — pas un onglet bottom |

Bottom nav actuel web (à calquer) :

`Accueil · Catégories · Messagerie · Panier · Compte`

### Guest vs auth

| Icône | Guest | Auth |
|-------|-------|------|
| Accueil / Catégories / Search | OK | OK |
| Panier drawer | OK (guest cart → merge login) | OK |
| Favoris `/wishlist` | OK (local) / merge login | OK |
| Tracking `/tracking` | OK (ref publique si connue) | OK |
| Cloche `/dashboard` | → `/auth` | OK |
| Messagerie | → auth | `/dashboard?tab=messages` |
| Compte `/account` | soft / redirect auth selon page | OK |

### Source bandeau promo top

- Setting bootstrap : **`topbar_config`** (`platform_settings` via `platform-bootstrap` / `useBootstrapSetting`)
- Champs : `enabled`, `messages[]` (`visible`), `mode` (`static` \| `slide` \| `marquee`), `link_url`, `dismissible`, `bg_color`, `text_color`
- Rendu : `Header.tsx` (~L88–294)

### Filtres Local / International

- UI : `HomeMarketSwitch` — valeurs `all` \| `local` \| `international`
- Persistance : `localStorage` clé `zandofy_home_market`
- Filtre data : `shopTypeFilter` → `stores.shop_type` (`local` \| `international`) passé au fetch produits home
- **Ne change pas** le checkout / geo eligibility (scope commercial = autre couche — voir `GEO_COMMERCIAL_SCOPE.md`)

---

## 3.2 Affichage poids g → kg — FOURNIR

### Règle exacte (PWA PDP)

Fichier : `frontend/src/pages/ProductPage.tsx` (~L804) :

```ts
product.weightGrams >= 1000
  ? `${(product.weightGrams / 1000).toFixed(1)} kg`
  : `${product.weightGrams} g`
```

| Stockage | Affichage |
|----------|-----------|
| `weight_grams` (int, DB) | `< 1000` → `"N g"` ; `≥ 1000` → `"X.Y kg"` (1 décimale) |

### Autres écrans web

| Écran | Comportement |
|-------|--------------|
| PDP `ProductPage.tsx` | Règle ci-dessus ✅ |
| Admin moderation `ProductModerationDetail.tsx` | Affiche encore `Ng` brut (admin OK) |
| Shipping calc | Convertit toujours `/1000` en kg pour devis (pas d’affichage PDP) |

**Mobile :** réutiliser **exactement** la règle PDP ci-dessus (pas inventer un seuil différent).

---

## 3.3 Moteur zones géographiques — FOURNIR (BLOQUANT)

### Cascade obligatoire

`Pays → Province → Ville → Commune → Quartier`  
**Seul free-text :** Adresse (n°, avenue, apt…) + éventuellement code postal.

### Schéma SQL (tables + RLS lecture publique)

| Table | Rôle | Migrations pivots |
|-------|------|-------------------|
| `provinces` | `id`, `name`, `country_code`, `is_active` — SELECT public | `20260331090110_…` |
| `cities` | `id`, `name`, `country_code`, `province_id`, `is_active`, population… | legacy + `province_id` |
| `communes` | `id`, `city` (name), `country_code`, `name`, `is_active` — SELECT public | `20260330090628_…` |
| `quartiers` | `id`, `commune_id` FK, `name`, `is_active`, `is_restricted` | idem |
| `saved_addresses` | `commune`, `quartier`, `province`, city, country, address… | colonnes text |
| `orders` | `shipping_commune`, `shipping_quartier`, `shipping_province`, **`shipping_city_id`** uuid FK → `cities` | `20260926137000_…` |

RLS : SELECT ouvert sur `provinces` / `communes` / `quartiers` (anyone) ; écriture admin/manager.

### Hook + composants picker web

| Pièce | Chemin |
|-------|--------|
| Cascade data hook | `frontend/src/hooks/useGeoData.ts` |
| Pays actifs | `frontend/src/hooks/useActiveGeo.ts` |
| Formulaire cascade complet | `frontend/src/components/address/CascadingAddressFields.tsx` |
| Variante row | `frontend/src/components/address/GeoFieldsRow.tsx` |
| Combobox geo | `frontend/src/components/address/GeoCombobox.tsx` |
| Country picker | `frontend/src/components/vendor/CountryCombobox.tsx` |

**API cascade (client Supabase, pas de RPC dédié) :**

1. `provinces` where `country_code`  
2. `cities` where `country_code` + `is_active` (+ `province_id` si choisi) — value affichée = **name**, garder `id` pour `shipping_city_id`  
3. `communes` where `city` = city **name** + `country_code` + `is_active`  
4. `quartiers` where `commune_id` = uuid commune + `is_active` + **exclure** `is_restricted`

### Mapping labels par pays

- Web utilise génériquement « Province » (pas de i18n state/région dynamique encore).
- Pour CD : province = provinces admin ; villes filtrées.
- Si **aucune province** pour un pays : villes listées par `country_code` seul (`provinceId` vide).

### Lien `cities.id` / `shipping_city_id` / eligibility

- Checkout persiste `shipping_city_id` (uuid) **en plus** des libellés text.
- Geo commercial : `product_eligible_for_destination`, `geo_eligibility_is_enforced` — doc [`docs/guides/GEO_COMMERCIAL_SCOPE.md`](./guides/GEO_COMMERCIAL_SCOPE.md)
- `geo_relation` / `fulfillment_lane` dérivés store↔destination (`frontend/src/lib/fulfillment-lane.ts`)

### Écrans web déjà sur le moteur

- Checkout adresse (`CheckoutPage` + CascadingAddressFields / GeoFieldsRow)
- Address onboarding (`AddressOnboardingDialog`)
- KYB vendeur champs adresse (`VendorKybV2Tab`)
- Discovery city picker (villes only)
- Vendor commercial scope / product destinations (villes)

### Niveau manquant

- Province absente pour un pays → **skip** (villes par country)
- Commune / quartier vides en DB → combobox vide ; **ne pas** free-text inventé pour ces niveaux (sauf si admin n’a pas peuplé — UX : utilisateur ne peut pas choisir)
- Quartiers `is_restricted` : **filtrés** côté client (non sélectionnables)

---

## 3.4 Checkout — transitaires & paiement frais — FOURNIR

### Parcours PWA sélection transitaire

| Étape | Composant |
|-------|-----------|
| Calculateur modes air/sea/… | `frontend/src/components/CheckoutShippingCalculator.tsx` |
| Offres freight (moteur principal) | `frontend/src/components/checkout/FreightSelector.tsx` |
| Multi store×origine | `frontend/src/components/checkout/MultiOriginFreightSelector.tsx` |
| Legacy forwarders (fallback) | `frontend/src/components/checkout/ForwarderSelector.tsx` |
| Allowlist | `frontend/src/lib/carrier-allowlist.ts` → RPC `get_carrier_allowlist_ids` |
| Lock / consume quotes | `frontend/src/services/freightQuoteCheckout.ts` |
| Page orchestration | `frontend/src/pages/CheckoutPage.tsx` |

Flux : `fetchEligibleFreightOffers` → (RPC `get_eligible_forwarders_v2` + profiles) → UI select → `lockFreightQuote` → à la création order `consumeFreightQuote`.

### Contrat forwarders / quotes

- RPC lecture : `get_eligible_forwarders_v2` (body : destination country/city, mode, origin…)
- Table `freight_quotes` : insert user-owned, status lock → consumed
- `shipping_cost` order = `quoted_price` verrouillé (pas le ratio UI)
- Allowlist vide / `null` = tous les forwarders éligibles couverture

### `shipping_payment_status` / choix qui paie

| Champ | Valeurs | Qui choisit |
|-------|---------|-------------|
| UI choice freight | `pay_now` \| `pay_on_arrival` | Buyer checkout (`shippingPaymentChoice`) — défaut **`pay_on_arrival`** |
| Persist order | `shipping_payment_status` : `deferred` \| `unpaid` \| `paid` | Dérivé : `pay_on_arrival` ou off-platform → `deferred` ; online pay_now → `unpaid` jusqu’au webhook |
| Last-mile fee | `last_mile_payment` : `pay_with_shipping` \| `pay_cash_on_delivery` | Buyer ; `pay_with_shipping` ajoute fee au total (sauf crédit Enterprise) |

### Multi-origine / multi-store

- Groupes `store_id|origin` via `groupCartByOriginAndStore`
- 1 FreightSelector par groupe ; total shipping = somme devis
- Orders : suffixes `-A/-B` ; `fulfillment_lane` par sous-order (`last_mile` \| `domestic` \| `freight`)
- Smoke : [`docs/CHECKOUT_SMOKE_CHECKLIST.md`](./CHECKOUT_SMOKE_CHECKLIST.md)

### Screenshots

Non joints ici — reproduire staging PWA `/checkout` étapes Expédition + paiement frais hub + last-mile.

---

## 3.5 Livraison locale / nationale (ETA + frais)

**État web :** partiel.

- **Last-mile same city** : operators + `calculateLastMileFee` / OperatorSelector — productisé
- **Domestic same country other city** : lane `domestic` ; shipping souvent proportionnel / modes locaux — **pas** un moteur ETA national complet documenté
- **International freight** : moteur CBM/kg + forwarders — productisé

**Mobile :** ne pas inventer barèmes nationaux. Quand le web productise ETA nationale, ce fichier sera mis à jour (tables/RPC/formules).

---

## 4. Nouveaux contrats à ajouter au probe mobile

| Contrat | Priorité | Hide-if-fail |
|---------|----------|--------------|
| `preview_included_delivery_credit` | Haute (checkout Enterprise) | Oui — fallback fee plein |
| `try_consume_included_delivery` | Haute (post-order) | Oui — fee restaurée serveur/client |
| `get_carrier_allowlist_ids` | Moyenne | Oui — null = no filter |
| `get_store_entitlements` | Haute (vendeur) | Oui — legacy flags |
| `refresh_kyb_completeness_score` | Moyenne (vendeur KYB) | Non critique si trigger docs OK |
| `assert_store_identity_ready` | Haute (publish) | Fail-closed publish |

Inventaire Edge existant : garder aligné avec `EDGE_INVOKE_INVENTORY.md` côté mobile.

---

## 5. Priorités web → mobile (confirmées)

1. **Zones géo** — implémenter cascade `CascadingAddressFields` / `useGeoData` sur adresses + checkout + KYC  
2. **Chrome** — aligner bottom nav + header + search sticky + topbar_config  
3. **Poids** — formatteur 1 ligne (règle PDP)  
4. **Freight UI** — brancher picker sur APIs déjà présentes + `shippingPaymentChoice`  
5. **Local/national ETA** — attendre productisation web  

---

## 6. Liens web utiles

| Doc | Rôle |
|-----|------|
| [`NATIVE_MOBILE_HANDOFF_INDEX.md`](./NATIVE_MOBILE_HANDOFF_INDEX.md) | Index paquet + Contract RPC |
| [`NATIVE_MOBILE_HANDOVER.md`](./NATIVE_MOBILE_HANDOVER.md) | Handoff long |
| [`VENDOR_PLANS_AND_FULFILLMENT_CONTRACT.md`](./VENDOR_PLANS_AND_FULFILLMENT_CONTRACT.md) | Plans, lanes, hub, RPC §8 |
| [`OPS_RUNBOOK_RELIABILITY.md`](./OPS_RUNBOOK_RELIABILITY.md) | Migrations 140–162 + crons |
| [`CHECKOUT_SMOKE_CHECKLIST.md`](./CHECKOUT_SMOKE_CHECKLIST.md) | 5 scénarios |
| [`guides/GEO_COMMERCIAL_SCOPE.md`](./guides/GEO_COMMERCIAL_SCOPE.md) | Eligibility commerciale |

---

*Mettre à jour ce fichier à chaque lot web qui touche auth, geo, checkout, discovery, chrome, shipping, vendeur.*
