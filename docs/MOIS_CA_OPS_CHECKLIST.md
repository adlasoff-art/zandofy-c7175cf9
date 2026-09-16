# Mois du CA — Ops checklist (W0–W5)

## SQL (mandatory order)

1. Commit migrations already in repo:
   - `supabase/migrations/20260916140000_kyb_deferred_and_free_vendor_caps.sql`
   - `supabase/migrations/20260916150000_vendor_mm_numbers_package.sql`
   - `supabase/migrations/20260916160000_mois_ca_audit_harden.sql` (MM expiry + KYB authz + products_public shop_type + product write gate)
2. Run **all three** files in **Supabase SQL Editor — staging** (order above).
3. Smoke staging: auth, product list (Import/Stock local badges), checkout MM platform vs vendor, become-vendor KYC-only, vendor approve with KYC (store created before status), withdraw/catalog blocked if gate blocked, MM package subscribe + expiry.
4. Run the **same SQL** in **production**.
5. Redeploy `generate-sitemap` edge function if not already (W0).

## Frontend

- Deploy Vercel (branch with these changes).
- GSC: request reindex `/` + top categories after geo-bot fix is live.

## Risk (~4000+ users)

- Additive only: no DROP. Withdrawals blocked only when delivered GMV ≥ threshold and KYB not approved.
- Admin MM overrides are never auto-disabled by the MM package trigger.
- Package `autonomous` deactivated (not deleted); historical subs remain readable.
