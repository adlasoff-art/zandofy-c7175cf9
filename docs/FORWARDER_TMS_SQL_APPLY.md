# Forwarder TMS — SQL apply order (W1–W4 + follow-ups + audit)

Apply **in order** on staging, smoke, then production:

1. `20260916210000_external_shipments_quote_geo.sql`
2. `20260916211000_forwarder_consignees_photos_wa.sql`
3. `20260916212000_forwarder_logos_bucket.sql`
4. `20260916213000_forwarder_members_wallet.sql`
5. `20260916220000_forwarder_wallet_credit_member_requests.sql`
6. `20260916223000_forwarder_audit_harden.sql` — RLS cancel-only, withdrawal RPC, credit harden

Then deploy Edge Functions:

- `admin-approve-forwarder-member`
- `admin-reject-forwarder-member`
- `forwarder-set-member-password`

Then deploy frontend (Vercel).

See also: `docs/FORWARDER_TMS_AUDIT_2026-09-16.md`
