---
name: Workflow Transitaire → Hub → Opérateur (lots H1-H6)
description: Visibilité différée des handoffs, bascule auto à l'arrivée au hub, switch client home→hub_pickup, onglets transitaire
type: feature
---
## H1 — Visibilité différée transitaire
- `forwarder_handoffs.visible_to_forwarder boolean default false`
- Trigger `create_forwarder_handoff_on_quote_consumed` insère en `pending` + invisible
- Trigger `trg_reveal_handoff_on_shipping` (orders AFTER UPDATE OF status) : quand `status='in_shipping'`, flip à `notified` + visible + notif in-app
- RLS SELECT transitaire filtre `visible_to_forwarder=true`

## H3 — Bascule auto delivered → suite
- Trigger `bridge_handoff_to_last_mile` réécrit :
  - Génère `pickup_code` (6 chiffres)
  - `delivery_choice='hub_pickup'` → `orders.status='ready_for_pickup'` directement
  - `delivery_choice='home'` (default) → `status='shipped'` ; si `delivery_operator_id` présent, set `operator_acceptance_status='pending'`, `operator_response_deadline=now()+30min`
  - Notif client unifiée selon branche

## H4 — Switch client home → hub_pickup à la dernière minute
- Edge function `switch-to-hub-pickup` (verify_jwt par défaut, validate user via getUser)
- UI : bouton dans `CustomerOrderTracker` quand `delivery_choice='home'` ET status ∈ {shipped, arrived_at_hub, at_hub, assigning_rider, rider_assigned}
- Annule operator/rider, génère pickup_code, notifie opérateur précédent + client

## H5 — RPC verify_hub_pickup
- `verify_hub_pickup(p_order_id, p_code, p_proof_url)` SECURITY DEFINER, admin/manager only
- Vérifie code, marque `pickup_code_verified_at`, `status='delivered'`, `delivered_at=now()`
- UI hub utilise `PickupCodeWidget` déjà branché dans `ShipperDashboardPage` (onglet Hub, query inclut `ready_for_pickup`)

## H6 — Onglets transitaire
- `ForwarderHandoffsPanel` : 4 onglets Nouveaux / En cours / Arrivés au hub / Annulés

## H2 — Notes transitaire = message client
- `log_handoff_event` enrichi : log `notes_updated` quand `internal_notes` change
- Trigger `trg_notify_customer_handoff_note` (AFTER UPDATE OF internal_notes) :
  - skip si note vide ou inchangée
  - throttle 30 min via `forwarder_handoff_events` count
  - in-app notif + appel `notify-handoff-status-customer` payload `{type:'note', note}`
- Edge function `notify-handoff-status-customer` gère `type='note'` (email + push)
- UI `ForwarderHandoffsPanel` : "Notes internes" → "Message au client", CTA "Envoyer au client"
- Timeline : libellé `notes_updated` = "Message envoyé au client"

## Reste à faire (lots ultérieurs)
- H7 : push web pour transitaire + opérateur (déjà partiel)
