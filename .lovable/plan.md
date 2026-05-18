## Diagnostic — pourquoi des commandes carte « non payées » apparaissent comme nouvelles

### Ce qui se passe aujourd'hui

1. **Insertion immédiate en `pending`** — `CheckoutPage.tsx` ligne 910 :

   ```text
   status = (mobile_money || off_platform) ? "awaiting_payment" : "pending"
   ```

   Donc une commande carte est créée directement en `pending` avant tout appel Keccel. Les vendeurs et l'admin la voient immédiatement comme « nouvelle commande ».

2. **Notifications déclenchées par `pending`** — `frontend/src/services/order-notifications.ts` :

   ```text
   NOTIFIABLE_STATUSES = ["pending", "confirmed", "in_shipping", ...]
   ```

   Tout passage à `pending` envoie push + mail + son vendeur/admin, même si le client n'a pas encore vu la page Mastercard.

3. **Vendeur ne filtre pas `awaiting_payment`** — `VendorOrderManager.tsx` ligne 174 :

   ```text
   .not("status", "in", '("payment_failed")')
   ```

   Les commandes en attente de paiement carte sont visibles côté vendeur.

4. **Aucune expiration pour carte** — Mobile Money a un timer 3+3 min. Carte n'a aucun garde-fou : si le client ferme l'onglet Mastercard sans payer, la commande reste indéfiniment en `awaiting_payment` (ou `pending` si l'extraction d'URL échoue, voir bug récent).

5. **Webhook OK** — `kelpay-webhook` fait déjà la bonne chose : il passe `awaiting_payment → pending` puis appelle `notify-order-status`. Le problème est donc en amont (création) et en aval (timeout), pas dans le webhook.

## Solution proposée

### 1. Créer la commande carte directement en `awaiting_payment`

`CheckoutPage.tsx` ligne 910 :

```text
status = (card || paypal || stripe || mobile_money || off_platform)
   ? "awaiting_payment"
   : "pending"
```

`pending` ne doit être atteint **que** par :
- COD (cash à la livraison, pas de webhook attendu)
- webhook KelPay/Keccel après paiement confirmé (déjà en place)
- validation manuelle off-platform par le vendeur (déjà en place)

### 2. Ne notifier qu'à la transition `awaiting_payment → pending`

Aujourd'hui `notify-order-status` est appelé depuis le webhook avec `newStatus="pending"` — c'est bon. Il faut juste s'assurer qu'aucun autre endroit ne déclenche une notification « nouvelle commande » au moment de l'INSERT :

- Vérifier qu'aucun trigger DB sur `INSERT orders` n'envoie déjà push/mail. Si oui, le conditionner à `NEW.status = 'pending'` au lieu de tout INSERT.
- Le checkout côté frontend ne doit **pas** appeler `triggerOrderStatusNotification` après l'insert. Seul le webhook le fait.

### 3. Masquer `awaiting_payment` côté vendeur et admin (liste « nouvelles commandes »)

- `VendorOrderManager.tsx` ligne 174 : exclure `awaiting_payment` du listing principal. Optionnel : un onglet séparé « En attente de paiement » discret, sans son ni badge.
- `AdminOrdersPage.tsx` : conserver la visibilité (admin doit voir), mais retirer `awaiting_payment` des KPIs « commandes valides » et des compteurs de tête. Le total « 28 commandes en attente » doit refléter uniquement `pending` (payées non encore confirmées par le vendeur).

### 4. Expiration automatique des cartes non payées

Aligner sur Mobile Money :

- Côté client `CheckoutPage.tsx` (déjà partiellement fait pour MM) : timer de **15 minutes** après redirection Mastercard. Au-delà, marquer la commande `payment_failed` si toujours `awaiting_payment`.
- Côté serveur : un cron (réutiliser un cron existant) qui passe en `payment_failed` toute commande carte/paypal/stripe restée en `awaiting_payment` depuis plus de **30 minutes** sans `payment_transactions.status = success`. C'est le filet de sécurité si le client ferme l'onglet.

### 5. Sons distincts succès vs échec

`frontend/src/lib/notification-sounds.ts` : ajouter un mapping par type de notification.

```text
order.created (paiement confirmé) -> son "new-order.mp3" (actuel)
order.payment_failed              -> son "failure.mp3" (court, neutre, non urgent)
```

Le hook `use-notifications` choisit le son selon `notification.type` ou un nouveau champ `severity`.

### 6. Non-régression

Ne pas toucher :

- payload Keccel `keccel-cardpay` (7 champs lowercase)
- logique Mobile Money (timer 3+3 min déjà OK)
- COD et off-platform (création directe pertinente)
- domaines / variables d'environnement / migrations existantes

## Impact attendu

```text
Avant :
  client clique "Payer par carte"
  → commande pending immédiate
  → push vendeur + admin
  → client ferme onglet Mastercard
  → commande reste pending pour toujours
  → KPI saturé

Après :
  client clique "Payer par carte"
  → commande awaiting_payment (invisible vendeur, visible admin onglet dédié)
  → aucune notification
  → si Mastercard confirme via webhook → pending + push + mail
  → sinon (timeout 15 min client / 30 min serveur) → payment_failed
```

## Détails techniques

### Fichiers à modifier

```text
frontend/src/pages/CheckoutPage.tsx
  - ligne 910 : étendre awaiting_payment à card/paypal/stripe
  - ajouter timer client 15 min pour card (similaire MM)

frontend/src/components/vendor/VendorOrderManager.tsx
  - ligne 174 : exclure awaiting_payment

frontend/src/pages/admin/AdminOrdersPage.tsx
  - séparer awaiting_payment des KPIs « valides » et « en attente »
  - ajouter onglet dédié si besoin

frontend/src/lib/notification-sounds.ts
  - mapping son par type/severity

frontend/src/hooks/use-notifications.ts
  - jouer son selon type

supabase/functions/<cron existant ou nouveau>/index.ts
  - sweeper 30 min pour card/paypal/stripe en awaiting_payment

supabase/migrations/<nouveau>.sql (si trigger DB notifie sur INSERT orders)
  - conditionner à status='pending' uniquement
```

### Tests à faire

```text
1. Paiement carte annulé (ferme onglet Mastercard)
   → vendeur ne reçoit RIEN
   → après 15 min : commande payment_failed côté client
   → après 30 min : sweeper serveur confirme payment_failed

2. Paiement carte réussi (webhook OK)
   → commande passe awaiting_payment → pending
   → vendeur reçoit push + mail + son "nouvelle commande"
   → KPI admin "valides" +1

3. Mobile Money inchangé (timer 3+3 min existant)

4. COD inchangé (création directe en pending)

5. Off-platform inchangé (validation manuelle vendeur)
```

### Déploiement

Aucun changement de domaine, secret ou architecture. Migrations SQL uniquement si un trigger DB est trouvé. Sortie par workflow GitHub vers `zandofy.com`.
