# Phase 10.5 — Clarification des rôles logistiques + Sécurité dual-code

## 1. État actuel des rôles (audit)

Dans `app_role` (enum DB) et `useRoles` (frontend), 7 rôles existent :

| Rôle DB | Espace dédié | Usage actuel | Statut |
|---|---|---|---|
| `admin` | `/admin/*` | Staff plateforme | Actif |
| `manager` | `/admin/*` | Staff plateforme | Actif |
| `vendor` | `/dashboard/*` | Boutique | Actif |
| `shipper` | `/shipper-dashboard` | **Transitaire / Hub** (réception cargo, dispatch) | Actif |
| `rider` | `/rider-dashboard`, `/driver` | Livreur individuel attaché à un opérateur (ou plateforme) | Actif |
| `operator` | `/operator/*` (7 pages) | **Entreprise de livraison tierce** (last-mile multi-villes) | Actif mais non visible tant qu'aucun user n'a ce rôle |
| `forwarder` | `/forwarder/*` | Transitaire international (fret aérien/maritime) | Actif |

### Pourquoi tu ne vois pas l'espace opérateur

L'espace `/operator/*` **existe déjà** (7 pages : dashboard, orders, fleet, coverage, rates, billing, settings) avec son layout `OperatorLayout.tsx` et la garde `RoleGuard allowedRoles={["operator"]}`. Il n'apparaît dans aucun menu parce que :
1. Aucun utilisateur n'a encore le rôle `operator` attribué dans `user_roles`.
2. `admin-create-operator` crée bien la ligne dans `delivery_operators` mais **n'attribue pas le rôle `operator`** au `owner_user_id`.
3. Il n'existe aucun lien de menu vers `/operator` (contrairement à vendor/admin).

C'est le bug de fond qui rend les opérateurs créés "invisibles" côté espace propriétaire.

## 2. Vérité officielle des rôles (à figer)

```text
┌─────────────────────────────────────────────────────────────────┐
│  CHAÎNE LOGISTIQUE ZANDOFY                                      │
├─────────────────────────────────────────────────────────────────┤
│  Vendeur (vendor) ──► Forwarder (forwarder) ──► Hub (shipper)   │
│                       fret international          réception      │
│                                                       │          │
│                                                       ▼          │
│                              Opérateur (operator) ── Livreur     │
│                              entreprise last-mile    (rider)     │
│                                                       │          │
│                                                       ▼          │
│                                                    Client        │
└─────────────────────────────────────────────────────────────────┘
```

| Acteur réel | Rôle DB officiel | Définition canonique |
|---|---|---|
| Transitaire international (fret Chine→RDC) | `forwarder` | Entreprise qui exploite des routes aériennes/maritimes, profils tarifaires, devis |
| Hub / Transitaire local (réception conteneur, point relais) | `shipper` | Personne/équipe qui réceptionne au hub, photographie, dispatche |
| **Entreprise de livraison last-mile** | **`operator`** | Société tierce (ou plateforme) avec flotte, couverture multi-villes, tarifs par quartier |
| **Livreur (employé d'un opérateur OU plateforme)** | **`rider`** | Personne physique qui prend en charge un colis et le livre. Toujours rattaché à un `operator` via `delivery_operator_riders` |
| Vendeur boutique | `vendor` | Propriétaire/collaborateur d'un store |
| Staff Zandofy | `admin` / `manager` | Plateforme |

**Différence clé livreur vs transporteur** :
- `rider` = **personne physique** qui livre (un humain avec moto/voiture)
- `operator` = **entreprise** qui emploie/fédère plusieurs `rider` et facture la plateforme

Un même utilisateur peut cumuler `operator` (propriétaire d'entreprise) + `rider` (s'il livre lui-même).

**Et `shipper` ?** Il reste : c'est le rôle du staff hub/transitaire local, qui n'est ni livreur ni opérateur — il gère la réception physique des cargos avant remise à un opérateur.

## 3. Plan d'action Phase 10.5

### Lot A — Activation effective du rôle opérateur

A1. **Migration SQL** (la migration listant `app_role` est déjà à jour avec `operator` + `forwarder`, à vérifier sur prod via `supabase--read_query`).

A2. **`admin-create-operator`** : après l'insert dans `delivery_operators`, INSERT dans `user_roles` (`user_id = owner_user_id`, `role = 'operator'`) avec `ON CONFLICT DO NOTHING`. Idem pour `become-operator-submit` lors de l'approbation (`admin-approve-operator`).

A3. **Backfill** : migration ponctuelle qui parcourt `delivery_operators` existants et attribue le rôle `operator` à tous les `owner_user_id` qui ne l'ont pas.

A4. **Menu/Navigation** : ajouter dans `AccountPage` / menu mobile une carte "Espace Opérateur" visible si `isOperator`, lien vers `/operator`. Idem pour `forwarder` et `shipper` s'ils n'y sont pas déjà.

A5. **`AdminOperatorsPage`** : ajouter un bouton "Archiver" (soft-delete via `is_active=false` + flag `archived_at`) pour gérer les doublons sans casser l'historique commandes. Empêcher la création d'un nouvel opérateur si un opérateur actif a déjà le même `owner_user_id` + même couverture (warning).

### Lot B — Sécurité dual-code (pickup + delivery)

#### B1. Schéma DB
Ajout sur `orders` :
- `pickup_code text` (6 chiffres, généré au passage du statut → `ready_for_pickup`)
- `pickup_code_verified_at timestamptz`
- `pickup_verified_by uuid` (rider qui a récupéré)
- `delivery_code text` (renommage de l'actuel `confirmation_code` OU alias)
- `delivery_code_verified_at timestamptz` (alias `delivered_at` côté code)

Index sur `(pickup_code)` partiel where not null + uniqueness scoped par `hub_id` + `pickup_code_expires_at`.

#### B2. Génération et diffusion
- Trigger `generate_pickup_code()` au passage `status = 'ready_for_pickup'` (colis arrivé au hub) → 6 chiffres random.
- Code visible :
  - **Hub/shipper** : sur la page `/shipper-dashboard` dans le détail colis ("Code de remise au livreur").
  - **Operator/rider** : envoyé via notification push + email à l'opérateur assigné, **et au rider une fois assigné** (`operator-assign-rider-to-order`).
  - **Pas visible client** (le pickup_code est interne hub↔rider).
- Le `delivery_code` reste comme aujourd'hui : visible **client uniquement** (compte + email + SMS au passage `out_for_delivery`).

#### B3. Edge Functions
- **Nouvelle** : `verify-pickup-code` (POST `{ order_id, code }`). Auth: rider ou shipper. Vérifie le code, marque `pickup_code_verified_at`, fait passer le statut à `picked_up_by_operator`, écrit ledger, notifie opérateur + client.
- **Existante** `verify-confirmation-code` → renommée logiquement `verify-delivery-code` (alias conservé pour compat). Vérifie `delivery_code` côté rider face au client, marque `delivered`.

#### B4. RLS
- `pickup_code` exposé en SELECT uniquement à : staff hub propriétaire (`shipper`/`admin`/`manager`) + rider/operator assignés à la commande.
- `delivery_code` exposé en SELECT uniquement à : client propriétaire de la commande + admin/manager (jamais au rider directement, le rider tape ce que dit le client).

#### B5. UI
- **Hub/Shipper** (`ShipperDashboardPage`) : bloc "Remettre au livreur" qui demande au shipper de saisir le `pickup_code` que le rider présente sur son app (ou inversement : le shipper voit le code et le donne oralement, et le rider le saisit dans son app — **modèle retenu : le hub voit le code, le rider le saisit**, plus sécurisé car le rider doit prouver qu'il sait le code avant de partir).
- **Rider** (`RiderDashboardPage`) : bouton "Récupérer un colis" → input 6 chiffres → appel `verify-pickup-code`.
- **Client/Rider** (existant) : flow `delivery_code` inchangé.

### Lot C — Documentation & memory

C1. Créer `mem/auth/logistics-roles-canonical.md` figeant la table de vérité ci-dessus.
C2. Mettre à jour `mem/features/multi-operator-delivery-system.md` (section Sécurité dual-code).
C3. Mettre à jour `mem/features/order-workflow.md` avec la nouvelle étape `picked_up_by_operator` et les deux codes.

## 4. Détails techniques (résumé pour exécution)

**Migrations SQL** (1 fichier `20260427_phase_10_5_dual_codes_and_operator_role.sql`) :
- ALTER TABLE `orders` ADD COLUMN pickup_code, pickup_code_verified_at, pickup_verified_by, pickup_code_expires_at.
- Trigger `trg_generate_pickup_code` BEFORE UPDATE OF status.
- Backfill `user_roles` pour propriétaires `delivery_operators`.
- Politique RLS `orders_select_pickup_code` (column-level via vue `v_orders_for_hub` ou via policy générale, à valider — option simple : exposer le champ via une RPC `get_pickup_code_for_order(order_id)` qui contrôle les rôles, plus sûr que RLS column-level).

**Frontend** :
- `OperatorLayout` : ajouter lien "Espace Opérateur" depuis `AccountPage` quand `isOperator`.
- `ShipperDashboardPage` : nouveau composant `HubPickupHandoff.tsx`.
- `RiderDashboardPage` : composant `PickupCodeInput.tsx`.
- `AdminOperatorsPage` : bouton "Archiver".

**Edge Functions** :
- `verify-pickup-code` (nouvelle, JWT verify=true, has_role rider OR shipper, validation Zod).
- `admin-create-operator` + `admin-approve-operator` : insert `user_roles`.
- `notify-operator-new-order` : enrichir avec `pickup_code` au moment où le colis est ready_for_pickup.

**Compatibilité** : aucun changement breaking sur `confirmation_code` existant — on l'alias en `delivery_code` côté UI seulement.

## 5. Ce qui sera livré (résumé non-technique)

À la fin de cette phase :
1. **Tu sauras qui fait quoi** : forwarder = fret international, shipper = hub local, operator = entreprise de livraison, rider = livreur individuel.
2. **L'espace opérateur sera enfin accessible** aux propriétaires d'entreprises de livraison (lien depuis leur compte, rôle attribué automatiquement à la création/approbation).
3. **Tu pourras archiver les opérateurs en doublon** depuis l'admin sans casser l'historique.
4. **Deux codes secrets distincts** sécuriseront chaque commande :
   - Un **code de retrait** (hub ↔ livreur) pour empêcher qu'un inconnu prenne le colis au hub.
   - Un **code de livraison** (client ↔ livreur) pour empêcher qu'un colis soit marqué livré sans vérification.
5. **Documentation à jour** dans la mémoire projet pour ne plus avoir d'ambiguïté.

Approuve ce plan pour que je l'implémente.