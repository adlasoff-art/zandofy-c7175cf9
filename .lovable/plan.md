## Plan d'implémentation — Workflow Commande → Transitaire → Hub → Opérateur

Décision : on **garde tous les champs existants** (handoffs + orders) et on ajoute les automatisations + UX manquantes pour rendre la chaîne 100 % opérationnelle, en restant rationnel (pas d'ajout superflu, pas de duplication).

---

### Lot H1 — Apparition du handoff côté transitaire seulement quand le vendeur expédie

**Problème actuel** : dès la validation de la commande, le trigger crée `forwarder_handoffs` en `pending` et le transitaire le voit déjà.

**Cible** : le transitaire ne voit la commande **qu'à partir de `orders.status = 'in_shipping'`** (= le vendeur a confirmé l'envoi par son fournisseur).

**Changements DB** :
- Garder la création du handoff au checkout (déjà en place, ligne minimale).
- Ajouter colonne `forwarder_handoffs.visible_to_forwarder boolean default false`.
- Trigger `AFTER UPDATE` sur `orders` : quand `status` passe à `in_shipping`, mettre `visible_to_forwarder = true` + `status = 'notified'` + `notified_at = now()` sur le handoff actif et appeler `notify-forwarder-handoff` via `pg_net`.
- Adapter la policy RLS forwarder pour filtrer `visible_to_forwarder = true`.
- Adapter `ForwarderHandoffsPanel` (filtre côté requête déjà couvert par RLS).

---

### Lot H2 — Notes du transitaire = notification client

Aujourd'hui un changement de `internal_notes` génère un événement `notes_updated` dans la timeline mais **ne notifie pas** le client.

**Changements** :
- Renommer en UI : "Note interne" → **"Message au client"** (champ `internal_notes` réutilisé tel quel pour ne rien casser).
- Trigger DB existant `forwarder_handoff_events` : sur insertion d'un event `notes_updated`, appeler `notify-handoff-status-customer` avec un payload `type='note'` (nouveau code).
- Edge function `notify-handoff-status-customer` : ajouter cas `note` → email + push + notif in-app au client, contenu = la nouvelle note.
- Throttle : max 1 notif/30 min par handoff (anti-spam) ; condensation des notes multiples dans un seul email si plusieurs notes en moins de 30 min.

---

### Lot H3 — Bascule automatique "Arrivé au hub" → suite du workflow

Quand le transitaire passe `forwarder_handoffs.status = 'delivered'` :

**Trigger DB nouveau** sur `forwarder_handoffs` AFTER UPDATE :
1. Passer `orders.status` à `'shipped'` (= "Arrivée au hub").
2. Générer `pickup_code` (8 caractères alphanumériques) + `pickup_code_generated_at = now()`.
3. Lire `orders.delivery_choice` :
   - `'home'` → mettre `operator_acceptance_status='pending'`, `operator_assigned_at=now()`, `operator_response_deadline = now() + interval '30 min'`, appeler `notify-operator-new-order` via `pg_net`.
   - `'hub_pickup'` → mettre `operator_acceptance_status='not_applicable'`, passer `orders.status` à `'ready_for_pickup'` directement, envoyer le `pickup_code` au client par email + push.

---

### Lot H4 — Le client peut basculer `home` → `hub_pickup` à la dernière minute

**UI client** (`CustomerOrderTracker`) :
- Quand `orders.status = 'shipped'` ET `delivery_choice = 'home'` ET `operator_acceptance_status` ∈ {`pending`, `accepted`} ET pas encore `out_for_delivery` → afficher bouton **"Finalement, je viens récupérer au hub"**.
- Confirmation modale rappelant le code de retrait + adresse de l'agence.

**Edge function nouvelle** `switch-to-hub-pickup` (verify_jwt=true, owner only) :
- Vérifie que `orders.status` ∈ {`shipped`, `assigning_rider`, `rider_assigned`}.
- Met `delivery_choice='hub_pickup'`, `delivery_operator_id=NULL`, `operator_acceptance_status='not_applicable'`, `assigned_rider_id=NULL`.
- Passe `orders.status` à `'ready_for_pickup'`.
- Envoie email/push à l'opérateur "Commande annulée — client a choisi le retrait".
- Renvoie le `pickup_code` au client.

Limite : interdit si `out_for_delivery` ou `delivered` (rider déjà en route).

---

### Lot H5 — Étape `ready_for_pickup` complète côté hub

- `ShipperDashboardPage` (espace hub) : nouvel onglet **"Retraits clients"** listant les `orders` avec `status='ready_for_pickup'` ET `delivery_choice='hub_pickup'`.
- Saisie du `pickup_code` par le staff hub → RPC `verify_hub_pickup(order_id, code)` :
  - Vérifie code + non expiré.
  - Met `pickup_code_verified_at=now()`, `pickup_verified_by=auth.uid()`.
  - Demande upload obligatoire `hub_pickup_proof_url` (photo client + colis).
  - Passe `orders.status='delivered'`.
  - Notifie le client (email + push) "Colis remis, merci !".

---

### Lot H6 — Espace transitaire : afficher les onglets cohérents

`ForwarderHandoffsPanel` : ajouter onglets pour clarifier la vie d'un handoff :
- **Nouveaux** (`notified`, vendeur vient d'expédier) — appelle à action.
- **En cours** (`acknowledged`, `in_transit`).
- **Arrivés au hub** (`delivered`, historique 30 j).
- **Annulés**.

Aucun nouveau champ DB. Pur filtre frontend.

---

### Lot H7 — Notifications push transitaire & opérateur

- Activer `sendWebPushSafe` (déjà importé dans `notify-handoff-status-customer`) pour aussi cibler l'owner du transitaire dans `notify-forwarder-handoff`.
- Idem dans `notify-operator-new-order` (déjà partiel).

---

### Détails techniques globaux

- Toutes les migrations dans `frontend/supabase/migrations/` (source de vérité) + déploiement via GitHub Actions sur prod (`vpt...yxf`).
- Edge functions touchées : `notify-forwarder-handoff` (modifs payload), `notify-handoff-status-customer` (cas `note`), `notify-operator-new-order` (push), **nouvelle** `switch-to-hub-pickup`.
- RPC nouveau : `verify_hub_pickup(p_order_id uuid, p_code text)` SECURITY DEFINER + RLS staff hub uniquement.
- I18n : ajouter clés FR/EN pour les nouveaux textes UI (`forwarder.message_to_customer`, `customer.switch_to_hub`, `hub.verify_pickup`, etc.).
- Mise à jour mémoire : étendre `mem://features/forwarders-and-logistics-system` et `mem://features/multi-operator-delivery-system` avec ces règles de visibilité + bascule.

---

### Ordre de livraison proposé

1. **H1** (visibilité différée transitaire) — fondation indispensable.
2. **H3** (bascule auto delivered → shipped + opérateur ou pickup) — débloque la chaîne.
3. **H4** (bascule client home → hub) — finalise le choix client.
4. **H5** (workflow staff hub `ready_for_pickup`) — boucle la branche pickup.
5. **H2** (notes = notif client) — UX.
6. **H6** (onglets transitaire) — UX.
7. **H7** (push manquants) — finition.

H1 → H5 sont couplés (mêmes triggers/migrations) : je propose de les livrer dans **un seul lot de migrations + edge functions**, puis H2/H6/H7 dans un second passage plus léger.

---

### Ce que je n'ai pas touché (rationalité)

- Pas de nouveau statut handoff (`pending/notified/acknowledged/in_transit/delivered/cancelled` suffisent).
- Pas de nouvelle table : tout réutilise `forwarder_handoffs`, `forwarder_handoff_events`, `orders`.
- Pas de modification des champs paiement / acompte / multi-leg — gardés pour l'avenir comme demandé.

Confirme-moi pour que je lance d'abord le **bloc H1+H3+H4+H5** (migrations + edge fns), puis enchaîne H2/H6/H7.
