

## Objectif global
1. **Ajouter une fonctionnalité** : réassignation de transitaire (vendeur limité à la ville client, admin sans restriction + routage multi-hop).
2. **Produire 3 documentations Markdown** (Client, Vendeur, Admin) couvrant 100% des parcours étape par étape, prêtes à servir de script pour tes vidéos d'écran.

Stack ciblée : preview Lovable → PR `develop` → `main` → Vercel prod. Aucun secret requis.

---

## Lot 1 — Réassignation de transitaire (code)

### 1.1 Migration SQL (`05_forwarder_reassignment.sql`)
- Nouvelle colonne `forwarder_handoffs.replaced_by_handoff_id UUID NULL` (FK vers lui-même) → trace la chaîne de remplacement.
- Nouvelle colonne `forwarder_handoffs.is_active BOOLEAN DEFAULT true` → un seul handoff actif par leg.
- Nouvelle colonne `forwarder_handoffs.leg_index SMALLINT DEFAULT 0` → 0 = leg principal (ex. Chine→ville client), 1 = leg secondaire (hub intermédiaire), etc. Permet le multi-hop admin.
- Nouvelle colonne `forwarder_handoffs.parent_handoff_id UUID NULL` → relie le leg 1 au leg 0 pour Chine→Kinshasa→Lubumbashi.
- Suppression de la contrainte unique `(order_id, forwarder_id)` → remplacée par un index partiel `UNIQUE (order_id, forwarder_id) WHERE is_active = true`.
- Trigger `trg_handoff_reassignment_event` : à chaque INSERT avec `replaced_by_handoff_id` non null, log automatique dans `forwarder_handoff_events` avec `event_type = 'reassigned'`.
- RPC `reassign_forwarder(p_handoff_id, p_new_forwarder_id, p_reason, p_actor_role)` :
  - Vérifie : si actor_role = 'vendor' → le nouveau forwarder DOIT couvrir la ville du client (lookup via `forwarder_restrictions`).
  - Marque l'ancien handoff `is_active=false`, status `cancelled`.
  - Crée un nouveau handoff actif (même `leg_index`, copie `freight_quote_id`).
  - Notifie via `notify-forwarder-handoff` (existant).
- RPC `add_intermediate_hub_handoff(p_order_id, p_hub_forwarder_id, p_destination_city)` (admin only) : crée un leg 1 (hub intermédiaire) lié au leg 0 par `parent_handoff_id`.

### 1.2 Frontend — Vendeur
- **`frontend/src/components/vendor/orders/ChangeForwarderDialog.tsx`** (nouveau) :
  - Liste les transitaires éligibles à la ville du client (filtre via `get_eligible_forwarders` RPC existant).
  - Champ "Raison du changement" obligatoire.
  - Confirmation puis appel RPC `reassign_forwarder(role='vendor')`.
- Bouton "Changer transitaire" ajouté dans `frontend/src/pages/VendorOrdersPage.tsx` (visible si commande en `prep` ou `shipped` ET pas encore `delivered`).

### 1.3 Frontend — Admin
- **`frontend/src/components/admin/orders/AdminReassignForwarderDialog.tsx`** (nouveau) :
  - Onglet 1 "Remplacement simple" → liste TOUS les transitaires actifs (pas de filtre ville).
  - Onglet 2 "Routage multi-hop" → choisir un hub intermédiaire + ville de transit (ex. Kinshasa) + transitaire pour le 2e leg. Appelle `add_intermediate_hub_handoff`.
- Intégré dans le drawer commande admin (`AdminOrderDetailPage` / panneau logistique).

### 1.4 Frontend — Client (lecture seule, pas d'édition)
- Dans `frontend/src/pages/OrderDetailPage.tsx` : afficher uniquement le **transitaire actuel actif**. Pas d'historique exposé (conformément à ta réponse). Si multi-hop, afficher la chaîne "Chine → Kinshasa (transit) → Lubumbashi" comme info de routage simplifiée, sans noms intermédiaires sensibles.

### 1.5 Audit trail
- L'historique est lisible côté **vendeur** dans le détail commande (timeline `HandoffEventsTimeline` existante, déjà filtre par `event_type`).
- L'historique est lisible côté **admin** via la même timeline + actions de réassignation horodatées.

---

## Lot 2 — Documentation Markdown (3 fichiers)

Tous générés dans `/mnt/documents/` et téléchargeables via `<lov-artifact>`.

### 2.1 `zandofy-guide-client.md` (~6-8 pages imprimées)
**Sections** :
1. **Installer l'app**
   - iOS Safari : étapes "Partager → Ajouter à l'écran d'accueil" (PWA)
   - Android Chrome : bannière "Installer l'app" + alternative menu
   - Capture/icône PWA Zandofy
2. **Créer un compte**
   - Page `/auth`, choix Email/Google
   - Email : confirmation envoyée → **vérifier les SPAMs/Promotions** si non reçu, expéditeur `notify@zandofy.com`
   - Resend disponible si pas reçu après 2 min
3. **Profil & adresses**
   - Compléter Pays > Province > Ville > Commune > Quartier
   - Sauvegarder une adresse de livraison par défaut
4. **KYC (vérification d'identité)**
   - Quand : déclenché à partir de la 3e commande
   - Documents acceptés (CNI/passeport/permis), selfie, justificatif d'adresse
   - Délai de validation, statuts (pending/approved/rejected/resubmission_required)
   - Blocage commandes après 10 commandes non vérifiées
5. **Trouver un produit**
   - Recherche, filtres, catégories, popularité
   - Wishlist (cœur), partage, badges certification
6. **Ajouter au panier & checkout**
   - Sélection variantes (taille, couleur, gros)
   - Choix transitaire (si activé) + délais + acompte
   - Choix livraison à domicile vs retrait au hub
   - Méthodes de paiement filtrées selon boutiques du panier
7. **Suivi commande**
   - Statuts (Confirmé → Préparation → Expédié → Hub → Livraison → Livré)
   - Voir le transitaire actuel, le tracking number
   - Photo de réception au hub
8. **Litiges & retours** (14-30j, qui paie le retour)
9. **Affiliation, points fidélité, abonnements livraison**
10. **Notifications** (push, email, paramétrage)

### 2.2 `zandofy-guide-vendeur.md`
1. Création boutique, KYB, certification (KYB+KYC)
2. Multi-store (3 mois + 10 ventes pour 2e boutique)
3. Catalogue : ajout produit, variantes, gros, fournisseurs
4. Tarification : markup 45%, commission 10%
5. Gestion commandes : préparation → expédié (vendor max = "shipped")
6. **Changement de transitaire** (NOUVEAU — lot 1) : conditions, écran, raison obligatoire, ville client uniquement
7. Simulateur fret (si toggle admin activé)
8. Comptabilité : grand livre unifié `v_vendor_revenue_by_method`
9. Litiges (chat tripartite)
10. Collaborateurs (quotas par pack), modération, transfert propriété

### 2.3 `zandofy-guide-admin.md`
1. **Configuration transitaires (étape par étape)**
   - Onglet `Admin → Transitaires` : créer profil (nom, slug, logo, adresse Chine, adresses pays desservis)
   - Configurer tarification (CBM/Kg/Pièce tiers, surcharges)
   - Restrictions (pays, villes, modes Air/Sea/Road/Rail)
   - Profils de pricing → activer/désactiver
   - Coverage par ville
2. **Activation globale du système transitaires**
   - Toggle `forwarders_config.enabled` dans Paramètres globaux
   - Modes fallback (auto_calc vs block)
3. **Hub Logistique**
   - Vue d'ensemble (carte temps réel flotte)
   - Assignation (préparation last-mile)
   - Livraisons (historique + manuel)
   - Suivi par commande (NOUVEAU — Lot 1 précédent) : drawer GPS rider+client
4. **Réassignation transitaire admin** (NOUVEAU — lot 1)
   - Remplacement simple (tout transitaire actif)
   - Routage multi-hop : créer leg intermédiaire (ex. Chine→Kinshasa→Lubumbashi)
   - Procédure d'urgence si transitaire indisponible
5. Modération boutiques (suspensions, bans)
6. Gestion KYC/KYB des utilisateurs et vendeurs
7. Configuration paiements (Mobile Money, Carte, COD, Hors-plateforme)
8. Branding, polices, templates emails
9. Marketing automation (13 workflows J0-J30)
10. Analytics (KPIs, charts)
11. Tarification boutique (packs services, simulateur vendeur toggle)
12. Sécurité (HIBP, sessions admin, impersonation)

### 2.4 Livraison
Trois balises `<lov-artifact>` à la fin de la réponse finale, une par fichier .md.

---

## Hors scope (à ne pas faire dans ce lot)
- Édition par le client de son propre transitaire après checkout
- Notifications push automatiques sur réassignation (déjà couvert par `notify-forwarder-handoff` existant)
- Vidéos / captures d'écran intégrées (toi tu films)
- Dépréciation du système legacy zones/routes (audit prod requis avant)

---

## Vérifications post-implémentation
- Lot 1 : créer commande de test → vendeur réassigne → vérifier que client voit le nouveau transitaire et PAS l'historique. Admin réassigne en multi-hop → vérifier 2 lignes dans `forwarder_handoffs` avec `parent_handoff_id`.
- Lot 2 : vérifier que les 3 .md sont téléchargeables et lisibles (markdown standard, pas de dépendance externe).

