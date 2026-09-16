# Forwarder TMS — Vague 1 gate (smoke checklist)

Run after applying `supabase/migrations/20260916210000_external_shipments_quote_geo.sql` on **staging**, then production.

## DB

- [ ] Migration applied without error (additive columns + RPC replace)
- [ ] `external_shipments` has nullable geo/quote columns
- [ ] `get_external_shipment_by_token` returns `weight_kg`, `quoted_amount`, country fields; still omits `notes`, `consignee_*`, `quote_breakdown`

## Forwarder UI (`/forwarder/shipments`)

- [ ] Origine/destination = GeoFields (pays obligatoire)
- [ ] Poids + profil tarifaire (mode + pays destination) → aperçu tarif
- [ ] Create bloqué si pas de palier / montant ≤ 0
- [ ] Notes = textarea
- [ ] Recherche + filtre statut
- [ ] Liste compacte (AWB, O→D, poids, montant, lien)

## Public tracking (`/t/:token`)

- [ ] Ancien lien legacy (sans poids) toujours OK
- [ ] Nouveau: poids + tarif visibles
- [ ] Notes internes non exposées

## Anti-régression

- [ ] Checkout marketplace / freight quote inchangé
- [ ] Admin impersonation → `/forwarder/shipments` OK
- [ ] Handoffs / tarifs pages inchangées fonctionnellement

## Production

- [ ] Même fichier SQL en prod après smoke staging
- [ ] Frontend déployé (Vercel) après SQL
