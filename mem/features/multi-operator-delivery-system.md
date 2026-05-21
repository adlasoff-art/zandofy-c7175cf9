---
name: Lot 11B — Système multi-opérateurs de livraison
description: B1 (DB) + B2 (UI/EF) + B3 (admin) + B4 (checkout) + B5 (dashboard ops) + B6 (email opérateur) + B7 (workflow accept/refus + expiration auto)
type: feature
---
Architecture multi-opérateurs (entreprises tierces) pour le last-mile.

**Tables clés** : `delivery_operators`, `delivery_operator_cities`, `delivery_operator_rates`, `delivery_operator_riders`, `operator_assignment_history` (B7).
**Vues** : `v_active_operators_by_city`, `v_geo_coverage_status` (10.2).
**orders** : `delivery_operator_id`, `operator_acceptance_status` (pending/accepted/declined/expired/not_applicable), `operator_assigned_at`, `operator_response_deadline` (30 min), `operator_responded_at`, `operator_decline_reason`, `operator_reassignment_count`.

**Règle critique d'activation (Phase 10.4)** : un opérateur n'est visible côté checkout (vue `v_active_operators_by_city`) que s'il a au moins une ligne `delivery_operator_rates` avec `status='approved'` et `is_active=true` sur la ville desservie. Donc :
- **Création admin** (`admin-create-operator`) DOIT insérer un tarif initial par ville couverte (champ `initial_rates` du body), puis ré-UPDATE pour passer `status='approved'` car le trigger `force_pending_on_rate_change` force pending à l'INSERT. Sinon "Livraison à domicile" reste désactivée au checkout avec "Aucun livreur ne dessert encore votre quartier".
- **Demande publique** (`become-operator-submit`) : tarifs restent en `pending`, validés via la page admin "Tarifs en attente".
- Opérateurs `is_platform_owned=true` : tarifs auto-approuvés par le trigger.

**Phase 10.2 — Couverture & flotte enrichies** :
- `delivery_operator_cities` : `province_id`, `commune_ids[]`, `quartier_ids[]` (granularité tarification).
- `delivery_operators.fleet_vehicles jsonb` `[{type, plate_number, brand?, model?}]` validé par trigger `validate_fleet_vehicles` (plaques uniques + non vides).
- Min **3 véhicules** + min **3 livreurs** (admin & KYB public).
- Composants partagés : `OperatorOwnerSearch` (PII-safe, search par prénom/nom uniquement), `OperatorCoveragePicker` (cascade Pays→Province→Ville→Communes→Quartiers), `OperatorFleetEditor` (avec plaques).
- `CreateOperatorDialog` (admin) + `BecomeOperatorPage` (public) utilisent les mêmes composants → structure DB identique.

**Edge Functions** :
- `become-operator-submit`, `operator-invite-rider`, `operator-assign-rider-to-order`, `operator-request-quota-increase`
- `admin-approve-operator`, `admin-reject-operator`, `admin-suspend-operator`, `admin-review-quota-request`
- `notify-operator-new-order` (in-app + email SMTP Hostinger)
- `operator-decide-order` (B7 — accept/decline via RPC `operator_decide_order`)
- `expire-operator-assignments` (B7 — cron, marque expired + détache + notif client)

**UI** :
- /become-operator (KYB), /operator/* (dashboard, orders avec onglet "À accepter", fleet, coverage, rates, billing, settings)
- /admin/operators, /admin/operator-quota-requests
- Checkout : `OperatorSelector` + `useOperatorQuotes` (hiérarchie quartier > commune > zone, plateforme prioritaire)

**Flow checkout B7** : commande créée avec `operator_acceptance_status='pending'` + deadline +30min → notif in-app + email à l'owner → opérateur accepte (status=accepted) ou refuse (détache, history, notif client) → si pas de réponse, `expire-operator-assignments` détache et journalise.

**Legacy** : `logistics-path.ts` deprecated. `VendorOrderManager` force `hasSelfDelivery=false`.
