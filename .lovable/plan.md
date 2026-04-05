

# Plan d'implémentation — Transfert de propriété, Modifications admin, Tarification & Abonnements

Ce plan est découpé en **4 lots** pour éviter de tout chambouler.

---

## LOT 1 — Transfert de propriété enrichi

### Contexte actuel
- Table `store_transfer_requests` existe déjà (store_id, from_user_id, to_user_id, status, admin_notes, cooldown_until, kyc_verified_from/to).
- Trigger `validate_store_transfer` gère les transitions de statut et le cooldown 72h.
- RLS : admins/managers full access, owners read-only.

### Modifications DB (migration)
- Ajouter colonnes à `store_transfer_requests` :
  - `transfer_type` text ('owner_initiated' | 'claim') — qui initie
  - `reason` text — motif du transfert
  - `documents` text[] — URLs des pièces jointes (KYB du nouveau proprio)
  - `claim_warning_accepted` boolean — le demandeur accepte le risque de sanction
  - `reviewed_by` uuid — admin qui traite
  - `reviewed_at` timestamptz
- RLS : ajouter politique INSERT pour les utilisateurs authentifiés (from_user_id = auth.uid() OR to_user_id = auth.uid())

### Logique métier
**Cas 1 — Réclamation (claim)** : Le prétendant passe par le KYB, à l'étape "nom de boutique" il clique "Réclamer une boutique", recherche par nom, sélectionne, accepte l'avertissement (sanction si infondé). Notification envoyée au propriétaire actuel + admin.

**Cas 2 — Transfert par le propriétaire** : Section "Transférer ma boutique" dans l'espace vendeur. Recherche utilisateur (photo + nom), description du motif, upload documents KYB du nouveau proprio. Seuls les utilisateurs KYC vérifiés sont sélectionnables.

**Post-approbation admin** : Reset des avantages du nouveau proprio :
- Rétention retrait → 30 jours strict
- Désactiver : coupons, collaborateurs, self-delivery, WhatsApp
- Transférer owner_id sur la table stores

### Pages UI
- **Admin** : Page `/admin/store-transfers` — liste des demandes, filtres par statut, actions (approuver/rejeter/demander révision), notes admin
- **Vendeur** : Section transfert dans le dashboard vendeur
- **KYB** : Ajout bouton "Réclamer une boutique" dans le flux KYB

---

## LOT 2 — Modifications admin contrôlées (email, téléphone, nom boutique)

### Logique
- Post-KYB validé, toute modification de : nom boutique, WhatsApp, email boutique, gérant contact → passe par une **demande de modification** soumise à validation admin.
- Nouvelle table `store_change_requests` :
  - id, store_id, requested_by, field_name (name | whatsapp | email | contact_person), old_value, new_value, status (pending | approved | rejected), admin_notes, reviewed_by, reviewed_at, created_at

### Admin
- Changement d'email d'un compte client vérifié : uniquement par l'admin via la page utilisateurs existante (Edge Function `admin-users` déjà en place)
- Page `/admin/store-change-requests` pour traiter les demandes

---

## LOT 3 — Tarification services vendeurs

### Nouvelle table `platform_service_plans`
- id, service_key (text unique), label, description, price_monthly, price_yearly, is_active, features (jsonb), created_at

Services couverts : gestion fournisseurs, COD, paiement hors plateforme, numéros personnalisés, retours autorisés, calcul marge auto, marge vendeur, coupons, collaborateurs, self-delivery, WhatsApp boutique.

### Page admin `/admin/vendor-pricing`
- CRUD des plans de service, activation/désactivation, tarifs mensuels/annuels
- Liaison avec `vendor_subscriptions` existante enrichie de colonnes jsonb `active_services` et `service_paid_until`

---

## LOT 4 — Abonnements livraison (clients & vendeurs)

### Table `delivery_subscriptions`
- id, user_id (nullable), store_id (nullable), plan_type ('client_monthly' | 'client_yearly' | 'vendor_5' | 'vendor_10' | 'vendor_20' | 'vendor_50' | 'vendor_100'), tier ('standard' | 'professional' | 'premium'), max_riders int, hub_storage boolean, price, paid_until, is_active, created_at

### Table `hub_storage_tracking`
- id, store_id, product_id (nullable), weight_kg numeric, arrived_at timestamptz, free_until timestamptz (arrived_at + 14 jours), daily_rate numeric default 0.59, is_penalty_active boolean, total_penalty numeric, last_penalty_at

### Grille livreurs (hardcodée en config, éditable par admin) :

```text
Plan         | Std | Pro | Premium
-------------|-----|-----|--------
5/jour       |  1  |  2  | 2 + Hub
10/jour      |  1  |  2  | 2 + Hub
20/jour      |  2  |  3  | 4 + Hub
50/jour      |  2  |  3  | 5 + Hub
100/jour     |  4  |  5  | 10 + Hub
```

### Stockage Hub
- Gratuit 14 jours, 0.59$/jour à partir du 15e jour si poids ≥ 1kg
- Semaine = lundi-samedi (hors jours fériés sauf livraison effectuée)
- Pénalité retenue à la source si impayée (via `vendor_wallets`)
- Concerne uniquement les boutiques indépendantes (`is_platform_owned = false`)

### Pages UI
- **Admin** : `/admin/delivery-plans` — gestion des plans et tarifs
- **Client** : section abonnement livraison dans le dashboard
- **Vendeur** : section abonnement livraison dans l'espace vendeur

---

## Fichier SQL de migration

Un seul fichier SQL idempotent sera généré couvrant :
1. Colonnes ajoutées à `store_transfer_requests`
2. Table `store_change_requests` + RLS
3. Table `platform_service_plans` + RLS
4. Table `delivery_subscriptions` + RLS
5. Table `hub_storage_tracking` + RLS
6. Politiques INSERT pour les transferts par utilisateurs
7. Seed data pour les plans de livraison

Le fichier sera fourni en téléchargement dans `/mnt/documents/`.

---

## Sécurité
- Toutes les approbations (transfert, changement, abonnement) passent par l'admin uniquement
- RLS strict : les vendeurs ne peuvent que soumettre et lire leurs propres demandes
- Les managers ont accès en lecture, seul l'admin peut approuver
- Audit log sur chaque action admin (table `admin_audit_logs` existante)
- Validation KYC obligatoire pour tout nouveau propriétaire de boutique

## Ordre d'implémentation
LOT 1 → LOT 2 → LOT 3 → LOT 4 (chaque lot est indépendant mais s'appuie sur la migration commune)

