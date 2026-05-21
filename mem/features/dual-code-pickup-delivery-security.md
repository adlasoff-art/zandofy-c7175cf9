---
name: Dual-code security (pickup + delivery)
description: Phase 10.5 — Deux secrets distincts par commande. pickup_code (hub↔rider, 6 digits) sécurise la prise en charge au hub. delivery_code (existant confirmation_code, client↔rider) sécurise la remise finale.
type: feature
---

## Modèle dual-code (Phase 10.5)

Chaque commande comporte **deux secrets distincts** :

| Code | Visible par | Saisie par | Vérifie |
|---|---|---|---|
| `pickup_code` (6 digits) | Hub/shipper, admin/manager, owner opérateur, rider assigné | **Rider** au hub | Que la bonne personne vient récupérer le colis |
| `delivery_code` (= `confirmation_code` existant) | **Client uniquement** + admin | **Rider** chez le client (le client lit le code, le rider tape) | Que le colis est bien remis au bon destinataire |

## Génération

- `pickup_code` : trigger `trg_generate_pickup_code` BEFORE UPDATE OF status sur `orders`. Génère 6 chiffres aléatoires uniques (parmi codes non encore vérifiés) au passage `status IN ('ready_for_pickup','arrived_at_hub','at_hub')`.
- `delivery_code` : conservation de la logique existante (`verify-confirmation-code`).

## RPC sécurisées

- `get_pickup_code_for_order(_order_id)` : SECURITY DEFINER, retourne le code au demandeur seulement s'il est admin/manager/shipper, owner de l'opérateur assigné, ou rider assigné. Sinon `RAISE EXCEPTION`.
- `verify_order_pickup_code(_order_id, _code)` : SECURITY DEFINER, contrôle même rôles, compare le code, met `pickup_code_verified_at` + `pickup_verified_by`, fait passer `status → picked_up_by_operator`.

## UI

Composant unique `frontend/src/components/logistics/PickupCodeWidget.tsx` :
- `mode="hub"` → affiche le code en gros caractères au staff hub (à donner oralement au rider).
- `mode="rider"` → input 6 chiffres + bouton "Valider" pour le rider.

À intégrer dans `ShipperDashboardPage` (détail colis arrivé) et `RiderDashboardPage` (détail course assignée). Le delivery_code reste géré par les écrans existants.

## Statuts orders impactés

Nouveau statut implicite : `picked_up_by_operator` (set par `verify_order_pickup_code`). À traiter ensuite comme l'ancien `out_for_delivery` côté flux livraison.

## Colonnes orders ajoutées

- `pickup_code text` (nullable, indexé partial)
- `pickup_code_generated_at timestamptz`
- `pickup_code_verified_at timestamptz`
- `pickup_verified_by uuid`