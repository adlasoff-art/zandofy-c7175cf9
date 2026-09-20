# Discovery Engine (Zandofy)

Platform-wide product ranking driven by guest/user onboarding prefs (`profiles.discovery_prefs` + localStorage) and CMS ratios (`platform_settings.auth_settings.discovery_mix`).

## Mix (defaults — editable in Admin → Auth settings)

| Bucket | Default % | Meaning |
|--------|-----------|---------|
| A Core | 65 | Audience + interest categories (incl. descendants) + geo |
| B Explore | 25 | International / other categories / other audience (small dose) |
| C Neutral | 10 | Unisex / empty gender only (not treated as male/female match in A) |

### Geo inside core (scope = city, Option 1 totals)

| Sub | Default % of total | Proxy V1 |
|-----|-------------------|----------|
| A1 City | 45 | `shop_type=local` + same `country_code`, seed partition |
| A2 Country | 20 | `shop_type=local` + same country, other partition |

- Scope **country**: 65% local + same country  
- Scope **any_country**: 65% profile across markets (soft-boost declared country)

True city-level store matching is **I7**: `prefs.city_id` ↔ `products_public.store_city_id`.  
Fallback V1 (seed partition of local+same-country) when city_id or store city is missing.

## Rotation

Seed = hash(userOrGuest + timeBucket(rotation_hours) + surfaceId). Default `rotation_hours: 12` so feeds renew within a day.

## Surfaces (web)

Home: FlashSales, TopTrends, Recommendations, ProductGrid, HomeCmsRails.  
Platform: Search, Category, Product related.  
FeaturedSidebar: soft-reorder **product** placements only (ads/stores keep CMS `sort_order`; skip if fewer than 4 product slots).

## Keys

- LS: `zandofy_discovery_prefs`, `zandofy_discovery_onboarding_snoozed`
- RPC: `set_own_discovery_prefs(jsonb)`
- Flag: `discovery_onboarding_enabled`
- Popup delay after onboarding: `discovery_popup_delay_sec` (default 15)

## Analytics

Events: `discovery_onboarding_*`, `discovery_feed_assembled`. Admin: Analytics page discovery section.

## Mobile / payments

See `docs/DISCOVERY_MOBILE_HANDOFF.md`. Prefs `country_code` + `payment_prefs` soft-wire checkout; CMS `payment_gateways` routes MoMo (KelPay / PawaPay stub).

## Staging → prod

1. Apply migrations under `supabase/migrations/` (discovery prefs + mix soft-merge + RPC).  
2. Smoke: Accueil soft sheet, complete Hommes+local, verify sections re-rank.  
3. Mirror SQL on production.
