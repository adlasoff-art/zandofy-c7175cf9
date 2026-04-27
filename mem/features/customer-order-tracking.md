---
name: Customer Order Tracking (Lot 12)
description: Suivi temps réel côté client connecté — RPC unifiée + carte Leaflet live + opérateur + handoffs internationaux
type: feature
---
# Lot 12 — Suivi commande client (temps réel)

## Architecture
- **RPC** `public.get_customer_tracking(p_order_id uuid) returns jsonb` (SECURITY DEFINER, GRANT EXECUTE TO authenticated uniquement, REVOKE FROM PUBLIC).
  - Vérifie `orders.user_id = auth.uid()` sinon `42501 Forbidden`.
  - Retourne `{ order, delivery, rider_location (is_fresh = updated_at > now()-30min), operator, handoffs[], shipments[] }`.
  - Masque PII client (`customer_phone`, `customer_name`, `address`).
- **Composant** `frontend/src/components/orders/CustomerOrderTracker.tsx`
  - Polling toutes les **10 s** (jamais de Realtime sur tables sensibles, cf. core rule).
  - Réutilise `DeliveryMap` (Leaflet + OSM) avec markers `rider` + `destination`.
  - Affiche : carte live, badge opérateur (Lot 11B avec logo/phone/rating), étapes forwarder (Lot 11A/C avec tracking_url externe), shipments AWB/BL legacy, code retrait hub.
- **Intégration** : `TrackingTab` dans `DashboardPage.tsx` (onglet "Suivi" du dashboard client) — un `<CustomerOrderTracker orderId>` par commande active.

## i18n
Clés `tracking.*` (FR/EN) dans `I18nContext.tsx` : `live`, `lastUpdate`, `error`, `gpsStale`, `rider`, `destination`, `operatorLabel`, `callOperator`, `internationalLegs`, `carrier`, `openCarrier`, `shipments`, `eta`, `pickupCode`, `noLiveData`.

## Statuts considérés "actifs" (badge live + polling)
`pending`, `confirmed`, `processing`, `shipped`, `ready_for_pickup`, `out_for_delivery`.

## Sécurité RLS
- `orders` : "Users read own orders" (`user_id = auth.uid()`) — déjà existant.
- `rider_locations` : "Customers read their delivery rider location" — déjà existant (JOIN deliveries→orders).
- Pour `deliveries`, `delivery_operators`, `forwarder_handoffs`, `shipments` : pas de policy client directe → **uniquement** accessibles au client via la RPC SECURITY DEFINER.

## Limites connues
- Pas de page publique `/track/:orderRef` (refusée explicitement par l'utilisateur — accès uniquement depuis dashboard client connecté).
- Pas de WebSocket (par design — polling 10 s).
