---
name: Lot 11B — Système multi-opérateurs de livraison
description: B1 (DB) + B2 (UI/EF) + B3 (admin) + B4 (checkout) + B5 (dashboard ops) + B6 (email opérateur) + B7 (workflow accept/refus + expiration auto)
type: feature
---
Architecture multi-opérateurs (entreprises tierces) pour le last-mile.

**Tables clés** : `delivery_operators`, `delivery_operator_cities`, `delivery_operator_rates`, `delivery_operator_riders`, `operator_assignment_history` (B7).
**Vues** : `v_active_operators_by_city`.
**orders** : `delivery_operator_id`, `operator_acceptance_status` (pending/accepted/declined/expired/not_applicable), `operator_assigned_at`, `operator_response_deadline` (30 min), `operator_responded_at`, `operator_decline_reason`, `operator_reassignment_count`.

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
