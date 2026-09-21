# Discovery Engine (Zandofy)

Platform-wide product ranking driven by guest/user onboarding prefs (`profiles.discovery_prefs` + localStorage) and CMS ratios (`platform_settings.auth_settings.discovery_mix`).

## Mix (defaults — editable in Admin → Auth settings)

| Bucket | Default % | Meaning |
|--------|-----------|---------|
| A Core | 65 | Audience + interest categories (incl. descendants) + **local geo** |
| B Explore | 25 | Local out-of-interest / transverse first; intl capped (see below) |
| C Neutral | 10 | Unisex / empty gender + soft non-apparel transverse |

### Geo + local-first

- Scope **city** / **country** = **local market** (not an equal local/intl mix).
- **Core never includes international** when scoped city/country.
- **`intl_cap_pct`** (default **10**, clamp 0–25): max share of **total take** that may be intl; applied inside explore. Ignored when scope is **any_country**.
- Fetch layer prefers `shop_type=local` for city/country, with open-market backfill only if the local pool is too thin.

### Geo inside core (scope = city)

| Sub | Default % of total | Proxy |
|-----|-------------------|-------|
| A1 City | 45 | `shop_type=local` + same `country_code`; true `store_city_id` when `prefs.city_id` set |
| A2 Country | 20 | local + same country, other partition / other cities |

- Scope **country**: core = local + same country  
- Scope **any_country**: core across markets (soft-boost declared country); explore intl uncapped by `intl_cap_pct`

True city-level store matching: `prefs.city_id` ↔ `products_public.store_city_id`.  
Fallback V1 (seed partition of local+same-country) when city_id or store city is missing.

### Apparel vs transverse (`categories.apparel_fields_enabled`)

- **Apparel** (flag or descendant): core requires strict audience gender match + interest.
- **Non-apparel in interests**: admitted to core even if unisex / empty gender.
- **Non-apparel outside interests**: appear in explore / neutral (≈10–25%), not forced by gender.
- Audience **male** / **female**: opposite gender is **excluded from explore** (local scope). `both` / `any` unchanged.

## Rotation

Seed = hash(userOrGuest + timeBucket(rotation_hours) + surfaceId). Default `rotation_hours: 12` so feeds renew within a day.

## Surfaces (web)

Home: FlashSales, TopTrends, Recommendations, ProductGrid, HomeCmsRails (local-first fetch).  
Platform: Search, Category, Product related (ranking only).  
FeaturedSidebar: soft-reorder **product** placements only (ads/stores keep CMS `sort_order`; skip if fewer than 4 product slots).

## Keys

- LS: `zandofy_discovery_prefs`, `zandofy_discovery_onboarding_snoozed`
- RPC: `set_own_discovery_prefs(jsonb)`
- Flag: `discovery_onboarding_enabled`
- Popup delay after onboarding: `discovery_popup_delay_sec` (default 15)
- Mix: `intl_cap_pct` soft-merge (absent → 10)

## Analytics

Events: `discovery_onboarding_*`, `discovery_feed_assembled`. Admin: Analytics page discovery section.

## Mobile / payments

See `docs/DISCOVERY_MOBILE_HANDOFF.md`. Prefs `country_code` + `payment_prefs` soft-wire checkout; CMS `payment_gateways` routes MoMo (KelPay / PawaPay stub).

## Staging → prod

1. Apply migrations under `supabase/migrations/` (discovery prefs + mix soft-merge + RPC).  
2. Smoke: Accueil Homme + ville/pays → majority local; intl ≤ ~10%; Maison non-apparel visible if chosen.  
3. Mirror SQL on production.
