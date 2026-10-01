# Ops runbook — fiabilisation (staging → production)

**Audience :** ops / admin technique  
**Date :** 2026-10-01

## 1. Migrations SQL (ordre strict)

Appliquer dans le SQL Editor **staging**, smoke, puis **production** :

### Fondation + Phase C + hotfixes

1. `20261001140000_store_identity_rpc_and_collab_select.sql`
2. `20261001141000_orders_off_platform_update_guards.sql`
3. `20261001142000_vendor_plan_definitions_and_entitlements.sql`
4. `20261001150000_entitlements_backfill_and_override_read.sql`
5. `20261001151000_included_delivery_quota.sql`
6. `20261001152000_orders_fulfillment_lane.sql`
7. `20261001153000_carrier_allowlists.sql`
8. `20261001154000_hub_storage_dual_billing.sql`
9. `20261001155000_phase_c_audit_hotfixes.sql`
10. `20261001160000_kyb_completeness_rescore.sql`
11. `20261001161000_preview_included_delivery_credit.sql`
12. `20261001162000_reliability_audit_hotfixes.sql` (KYB submit gate + consume authz/total)
13. `20261001163000_restore_stores_select_for_vendors.sql` (**hotfix** vendor/admin store SELECT)
14. `20261001164000_list_my_vendor_stores_rpc.sql` (**hotfix** RPC `list_my_vendor_stores` — chemin vendor dashboard)
15. `20261001165000_platform_stores_product_quota_exempt.sql` (**hotfix** platform shops unlimited products + team product SELECT)

Skip already-applied files (idempotent where possible).

## 2. Edge Functions

| Function | Env | Notes |
|----------|-----|--------|
| `accrue-hub-storage` | `SUPABASE_SERVICE_ROLE_KEY`, `HUB_ACCRUE_CRON_SECRET` or `CRON_SECRET` | Daily cron; Authorization Bearer = secret or service role |

Deploy root `supabase/functions/` only — never `frontend/supabase/` (removed).

## 3. Smoke checklist (staging)

See [`docs/CHECKOUT_SMOKE_CHECKLIST.md`](./CHECKOUT_SMOKE_CHECKLIST.md) + :

- [ ] Login / profile read (own row)
- [ ] Vendor KYB : fill fields + 5 docs → submit enabled (score ≥ 80)
- [ ] Collab : `assert_store_identity_ready` publish path
- [ ] Admin pricing save (margins) + Subscriptions feature toggles
- [ ] PWA : hard refresh after deploy — no chunk Oops

## 4. Identity / soft-delete

- Soft-deleted profiles: restrictive hide + own SELECT restored (`155000`)
- Platform-owned stores exempt from WA identity gate

## 5. Hub billing

- `register_hub_storage_arrival` — owner/collab/admin only
- Accrue only while `departed_at IS NULL`
- Buyer 21d / $1/day ; vendor 14d / rate×kg
