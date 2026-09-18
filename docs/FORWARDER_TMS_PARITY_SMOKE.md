# Forwarder TMS — Parité admin ↔ transitaire (smoke gates)

Run after each vague on **staging**, then production for SQL. Do not merge the next vague until the current gate passes.

## Prerequisites

- [ ] Migrations applied: `20260916210000_external_shipments_quote_geo.sql`, `20260916211000_forwarder_consignees_photos_wa.sql`
- [ ] Parity migrations: `20260918120000_external_shipments_cbm_billing.sql`, `20260918210000_parity_audit_harden.sql`
- [ ] Bucket `external-shipment-photos` exists (private)
- [ ] **Deploy SQL before frontend** when schema touched (`total_cbm`, `billing_basis=cbm`, coverage key backfill)

## Anti-touch list (do not regress)

- Kelpay / checkout payment
- Wallet credit triggers (`credit_forwarder_wallet_for_order`)
- Edge Functions équipe (approve/reject member)
- RPC formula body of `quote_forwarder` (consume only unless explicitly changed)

## Checkout marketplace

- [ ] Air quote with profile `city_id` set (exact city)
- [ ] Air/sea quote with profile `city_id` NULL (country-wide fallback via `get_eligible_forwarders_v2`)
- [ ] Sea CBM tiers still quote correctly
- [ ] Eligible forwarders still filtered by `coverage_routes` + `supported_modes`
- [ ] **Audit gate:** after saving a route in MapPin / `/forwarder/coverage`, JSON contains `destination_country` (not only `dest_country`) and checkout still lists the forwarder
- [ ] **Audit gate:** legacy rows with only `dest_country` still match after `20260918210000` (COALESCE alias)

## TMS create (`/forwarder/shipments`)

- [ ] **Kg-only**: quantity hidden; weight total; quote > 0; create OK
- [ ] **Piece**: category + quantity visible; min qty respected; quote = price × qty; weight/CBM not inflated by qty
- [ ] **Sea + CBM**: CBM field visible when profile has CBM tiers; quote > 0
- [ ] Create blocked without applicable tier / amount ≤ 0
- [ ] Create blocked while `quoteLoading` (no stale snapshot)
- [ ] Create re-quotes via `quote_forwarder` before insert
- [ ] Profile picker prefers city-exact profile when destination city matches
- [ ] Photos: 2 valid images → public tracking shows them
- [ ] Photos: 1 invalid/oversized → shipment created + clear toast
- [ ] Photos: if DB path update fails, storage objects cleaned (no orphans)

## Public tracking (`/t/:token`)

- [ ] Legacy row (no weight/quote) still loads
- [ ] New row: weight / **CBM** / quoted amount as applicable
- [ ] Internal notes never exposed
- [ ] Photo signed URLs work for path folder = `public_token`

## Tarifs sync

- [ ] Admin `$` and `/forwarder/profiles` show the same profiles/tiers
- [ ] Edit pickup / volumetric / consolidation on forwarder → visible in admin `$`
- [ ] Forwarder (owner **or** active member) can add a restriction → appears at checkout
- [ ] Member can add kg/CBM/piece tiers (RLS aligned via `user_owns_forwarder_profile`)

## Couverture

- [ ] Admin MapPin and `/forwarder/coverage` edit the same `forwarders.coverage_routes` JSONB
- [ ] Change a route → checkout eligibility updates (no `forwarder_coverage` dependency)
- [ ] Edit admin form “Enregistrer” does **not** wipe routes saved by CoverageRoutesEditor

## Analytics

- [ ] Platform freight (wallet / paid) and TMS quoted CA shown as **separate** blocks
- [ ] No single merged “CA total” across currencies without conversion

## Production

- [ ] Same SQL files applied after staging smoke (`20260918120000` then `20260918210000`)
- [ ] Frontend deploy (Vercel) after SQL when schema touched
