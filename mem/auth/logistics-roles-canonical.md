---
name: Logistics roles canonical truth
description: Vérité officielle des 7 rôles app_role (admin/manager/vendor/shipper/rider/operator/forwarder), définition canonique de chaque acteur de la chaîne logistique
type: feature
---

## Chaîne logistique Zandofy (figée Phase 10.5)

Vendeur → Forwarder (fret international) → Shipper (hub local) → Operator (entreprise last-mile) → Rider (livreur) → Client

## Table de vérité des rôles `app_role`

| Acteur réel | Rôle DB | Espace dédié | Définition |
|---|---|---|---|
| Staff plateforme | `admin` / `manager` | `/admin/*` | Modération, configuration globale |
| Vendeur boutique | `vendor` | `/dashboard/*`, `/vendor` | Propriétaire ou collaborateur d'un store |
| Transitaire international (fret aérien/maritime Chine→RDC) | `forwarder` | `/forwarder/*` | Entreprise exploitant routes long-courrier, profils tarifaires |
| Hub / transitaire local (réception conteneur, point relais) | `shipper` | `/shipper-dashboard`, `/shipper` | Staff réceptionnant cargo au hub, photographiant, dispatchant |
| **Entreprise de livraison last-mile** | **`operator`** | `/operator/*` (7 pages) | Société tierce avec flotte multi-véhicules + couverture multi-villes + tarifs par quartier. Lot 11B |
| **Livreur (personne physique)** | **`rider`** | `/rider-dashboard`, `/driver`, `/rider` | Humain qui livre. Toujours rattaché à un `operator` via `delivery_operator_riders` |

## Différences clés

- **`rider` vs `operator`** : rider = humain qui livre ; operator = entreprise qui emploie/fédère plusieurs riders et facture la plateforme.
- **`shipper` vs `forwarder`** : shipper = staff hub local côté réception ; forwarder = entreprise de fret international amont.
- Un même utilisateur peut cumuler plusieurs rôles (ex: `operator` + `rider` s'il est propriétaire et livre lui-même).

## Activation effective du rôle `operator`

1. **Création admin** (`admin-create-operator`) : insère ligne dans `delivery_operators` + tarifs initiaux approuvés + **upsert `user_roles` (operator)** + notification in-app.
2. **Création publique KYB** (`become-operator-submit` → `admin-approve-operator`) : rôle attribué à l'approbation.
3. **Backfill Phase 10.5** : tous les `delivery_operators.owner_user_id` existants ont reçu le rôle `operator` via migration.
4. **Liens menu** : `MobileAccountMenu.tsx` (l.86) et `Header.tsx` (l.315) affichent automatiquement "Espace opérateur" quand `isOperator===true`.

## Archivage opérateurs (Phase 10.5)

`delivery_operators` a 3 colonnes nullable : `archived_at`, `archived_by`, `archive_reason`. La vue `v_active_operators_by_city` exclut les opérateurs archivés (ils disparaissent du checkout sans casser l'historique). UI : bouton "Archiver" dans `AdminOperatorsPage` + onglet "Archivés" pour restaurer.