# Vendor plans & fulfillment contract (Zandofy)

**Status:** Phase C implemented (schema + dual-read entitlements + quota + lanes + allowlists + hub accrual) — admin plan editor still deferred  
**Date:** 2026-10-01  
**Audience:** Web, admin, mobile native
---

## 1. Commercial plans (DB: `vendor_plan_definitions`)

| Slug | Label | max_products | max_stores | Included features (default) | Last-mile inclus |
|------|-------|--------------|------------|-----------------------------|------------------|
| `beginner` | Débutant | **20** | 1 | (none — vente + commission only) | 0 |
| `intermediate` | Intermédiaire | **50** | 2 | `custom_payment_numbers`, `coupons` | 0 |
| `pro` | Professionnel | **100** | 5 | + `whatsapp_store`, `self_delivery`, `supplier_management` | 0 |
| `enterprise` | Entreprise | **250** | 10 | + `auto_margin_calc`, `cod_payment`, `off_platform_payment`, `collaborators` | **4 / mois calendaire** |
| `grand_supplier` | legacy alias | same as enterprise | | same | same |

### Enterprise included deliveries

- Count: **4 per calendar month**
- Lane: **last-mile only**
- Bound to **one store** (the store consuming the quota)
- Each included delivery order: **≤ 10 kg** (`max_kg_per_included_delivery = 10`)
- Beyond 4 or >10 kg → buy `delivery_pack` addon (or pay operator)

### Never included in any plan (addons only)

| Feature key | Notes |
|-------------|--------|
| `hub_storage` | See §3 hub dual billing |
| `delivery_pack` | Extra last-mile credits |

### Resolution order (`get_store_entitlements`)

```
admin_revoke > admin_grant > addon (paid_until) > plan.included_feature_keys
max_products / max_stores: vendor_pricing_overrides.*_override ?? plan.*
```

Admin may enable/disable **any** feature on **any** store regardless of plan.  
Vendors may subscribe/unsubscribe addons not in their plan defaults.

RPC: `get_store_entitlements(p_store_id uuid)` → jsonb.

Migration: `20261001142000_vendor_plan_definitions_and_entitlements.sql`.

---

## 2. Fulfillment lanes (Phase C — design locked)

One **`orders` row = one lane**:

| Lane | When | Checkout UI |
|------|------|-------------|
| `last_mile` | same city / local product | **Livraison** only (ops / self-delivery) — **no forwarder** |
| `domestic` | same country, other city | National transport / delivery methods |
| `freight` | cross-border | **Expédition / transitaire** |

**Mixed cart** (local + international lines): **auto-split** + recap « N envois ».

### `shop_type`

- `local` → **cannot** create international-scoped products
- Change local → international → **admin validation** required

### Carrier eligibility (Phase C)

Vendors define eligible **operators** and **forwarders** per store and/or product for A→B by lane.  
Checkout intersects allowlist ∩ coverage ∩ payment methods required by the carrier (COD / off-platform / online as defined by forwarder).

---

## 3. Hub storage (dual regime — Phase C billing)

| Actor | Free period | Then |
|-------|-------------|------|
| **Vendor** inventory in hub | **14 days** for a **new product** only; restocking ≤14d → no storage fee (pay delivery/movement instead) | $/kg/day |
| **Buyer** (intl order at hub, e.g. China) | **21 days** after hub arrival | **$1 / day** |

Not included in commercial plans.

---

## 4. Last-mile ops model

- Platform last-mile: **admin** configures covered cities
- Vendors may subscribe to **other platform operators** covering their sell zones
- Self-delivery (Pro+ entitlement): concurrent last-mile option when ON

---

## 5. Security / identity (shipped with foundation)

- `assert_store_identity_ready(store_id)` — platform-owned exempt; else logo+banner+country+WhatsApp
- Collaborators: SELECT policy on `stores` + identity RPC (not `stores_public` for authz)
- Orders: trigger blocks buyer self-confirm deferred + non-admin forging `off_platform_admin_released_*`

Migrations:

- `20261001140000_store_identity_rpc_and_collab_select.sql`
- `20261001141000_orders_off_platform_update_guards.sql`

---

## 6. Phase C status

| Item | Status |
|------|--------|
| 1. Checkout UI split by lane + auto cart split | **Shipped** — `fulfillment_lane`, `groupCartByStoreAndLane`, récap « N envois » |
| 2. Allowlists operators/forwarders (store + product) | **Shipped** — empty = no filter |
| 3. Hub billing jobs (14j / 21j) | **Shipped** — `register_hub_storage_arrival`, Edge `accrue-hub-storage` |
| 4. Admin UI editor for `vendor_plan_definitions` | Deferred (seed + RPC live; editor later) |
| 5. Vendor Pricing UI driven by `get_store_entitlements` | **Partial** — dual-read hook + admin mirror writes |
| 6. Wire publish / coupons / WA / COD gates to entitlements | **Shipped** (dual-read + checkout flags RPC) |

### Migrations Phase C

- `20261001150000_entitlements_backfill_and_override_read.sql`
- `20261001151000_included_delivery_quota.sql`
- `20261001152000_orders_fulfillment_lane.sql`
- `20261001153000_carrier_allowlists.sql`
- `20261001154000_hub_storage_dual_billing.sql`

### Hotfix audit (2026-10-01)

Migration `20261001155000_phase_c_audit_hotfixes.sql`:

- Restore `Users read own profile` (broken by restrictive-only soft-delete)
- Harden `try_consume_included_delivery` (authz, lane, advisory lock, revoke anon)
- Harden `register_hub_storage_arrival` + `departed_at` accrual stop
- Entitlements: dual-read then **admin_revoke wins**; checkout flags include addons
- Local shop: resolve `inherit` → `default_commercial_scope`
- Force `fulfillment_lane` from `geo_relation`
- Allowlist product intersection; buyer cannot forge fee/lane columns

Apply **after** `150000–154000` on staging then production.

### Reliability (R0–R2)

- `20261001160000_kyb_completeness_rescore.sql`
- `20261001161000_preview_included_delivery_credit.sql`
- Ops: [`docs/OPS_RUNBOOK_RELIABILITY.md`](./OPS_RUNBOOK_RELIABILITY.md)
- Smoke: [`docs/CHECKOUT_SMOKE_CHECKLIST.md`](./CHECKOUT_SMOKE_CHECKLIST.md)

---

## 8. Contract RPC (web + mobile natif)

| RPC | Auth | Usage |
|-----|------|--------|
| `get_store_entitlements(store_id)` | owner/collab/admin | Features + quotas |
| `get_checkout_vendor_payment_flags(store_ids[])` | anon/auth | Checkout payment modes |
| `assert_store_identity_ready(store_id)` | owner/collab | Publish gate |
| `try_consume_included_delivery(...)` | order buyer | Enterprise credit |
| `preview_included_delivery_credit(store_id, kg)` | anon/auth | Fee preview |
| `get_included_delivery_quota(store_id)` | store team | Vendor counter |
| `get_carrier_allowlist_ids(...)` | anon/auth | null = no filter |
| `refresh_kyb_completeness_score(id)` | store team | KYB submit unlock |
| `register_hub_storage_arrival(...)` | store team | Hub tracking |
| `accrue_hub_storage_charges(date)` | service_role | Cron only |

**KYB submit (serveur `162000`) :** transition vers `submitted` refusée si score &lt; 80 ou &lt; 5 docs requis.

**Dashboard vendeur :** RPC `list_my_vendor_stores()` (`164000`) en chemin principal ; sinon table `stores` (RLS `163000`). Ne pas s’appuyer seul sur `stores_public` (filtre catalog).

Legacy columns (`vendor_*_enabled`, `can_create_coupons`) remain **write mirrors**; reads prefer entitlements / checkout flags RPC.

---

## 7. Staging → production checklist (foundation A+B)

1. Apply `20261001140000`, `20261001141000`, `20261001142000` on **staging**
2. Smoke: vendor dashboard FULL select (moderation fields present); WA checklist from subscription
3. Smoke: collab can load store + publish platform store without identity block
4. Smoke: CMS logo shows when `header_logo_url` set
5. Smoke: buyer cannot UPDATE deferred order to `pending`; vendor cannot set `off_platform_admin_released_at`
6. `SELECT get_store_entitlements('<store_uuid>');`
7. Same SQL on **production**
8. Then apply Phase C migrations (§6)