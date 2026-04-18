

User reports orders staying in "awaiting_payment" forever when client abandons. Wants automatic transition to "payment_failed" after timeout. Already exists `expire-pending-orders` edge function with 30min threshold but apparently not running on cron, OR threshold too long.

Let me check the current logic and propose a tightened expiration strategy with multiple layers.

Plan based on what I've seen:
- `expire-pending-orders` exists, expires after 30min, sets to `payment_failed`, notifies user
- Need: shorter timeout (6min = 3min wait + 3min grace), client-side trigger when leaving page, cron schedule

## Réflexion sur le problème

Tu as raison : un paiement qui reste en `awaiting_payment` indéfiniment est dangereux (risque de traiter une commande non payée). La fonction `expire-pending-orders` existe déjà mais :

1. Elle expire après **30 minutes** (trop long pour KelPay qui timeout à 3 min)
2. Elle n'a probablement **pas de cron** activé en prod → elle ne tourne jamais automatiquement
3. Aucun déclenchement côté client quand l'utilisateur quitte la page de paiement

## Stratégie proposée — 3 couches de sécurité

### Couche 1 — Expiration serveur agressive (cron toutes les minutes)

Modifier `expire-pending-orders` pour utiliser **6 minutes** au lieu de 30 :
- 3 min = délai KelPay côté gateway
- +3 min de grâce pour absorber le délai du dernier "Vérifier" manuel
- Au-delà → `payment_failed` automatique + notification

Ajouter un **cron job pg_cron** qui appelle la fonction toutes les minutes :
```sql
select cron.schedule('expire-pending-orders-every-min', '* * * * *', ...);
```

### Couche 2 — Déclenchement client à l'abandon de page

Dans `CheckoutPage.tsx` et `RetryPaymentModal.tsx`, ajouter :
- Listener `beforeunload` / `visibilitychange` quand on est en état `paymentPending`
- Quand l'utilisateur ferme l'onglet ou navigue ailleurs **après expiration du compte à rebours**, déclencher un appel à une nouvelle edge function `mark-payment-abandoned` qui :
  - Vérifie une dernière fois auprès de KelPay (`kelpay-check`)
  - Si toujours pending → marque l'ordre en `payment_failed`
  - Si succès → finalise normalement

### Couche 3 — Auto-expiration côté UI quand le compteur atteint 0

Dans `PaymentWaitingPanel`, quand `onExpire` se déclenche et que l'utilisateur ne clique sur "Vérifier" pendant 60 secondes supplémentaires → appel automatique à `mark-payment-abandoned` puis redirection vers `/dashboard` avec message "Paiement expiré, vous pouvez relancer depuis vos commandes".

## Comportement final en production

Scénario A — Client ferme l'onglet à 2 min :
1. `beforeunload` → appel `mark-payment-abandoned` (keepalive fetch)
2. Vérification finale KelPay → pending → ordre passe `payment_failed`
3. Notification reçue : "Paiement expiré"

Scénario B — Client reste sur la page mais n'agit pas :
1. Compte à rebours expire à 3 min
2. Bouton "Vérifier" pulse pendant 60s
3. Auto-déclenchement `mark-payment-abandoned` → `payment_failed`
4. UI affiche écran d'échec avec lien dashboard

Scénario C — Filet de sécurité (peu importe ce qui s'est passé) :
1. Cron tourne chaque minute
2. Tout ordre `awaiting_payment` > 6 min → `payment_failed` + notification
3. Tu vois disparaître les "fantômes" de ton tableau de bord admin

## Fichiers à créer/modifier

**Nouvelles :**
- `frontend/supabase/functions/mark-payment-abandoned/index.ts` — edge function appelée par le client
- Migration SQL : `cron.schedule` pour `expire-pending-orders` chaque minute (à appliquer manuellement en prod via SQL Editor car contient l'URL prod)

**Modifiées :**
- `frontend/supabase/functions/expire-pending-orders/index.ts` — passer le seuil de 30 min à 6 min, mettre à jour le message de notification
- `frontend/src/pages/CheckoutPage.tsx` — ajouter listener `visibilitychange`/`beforeunload` + auto-trigger après expiration
- `frontend/src/components/payments/RetryPaymentModal.tsx` — même logique d'abandon
- `frontend/src/components/payments/PaymentWaitingPanel.tsx` — prop `onAutoAbandon` déclenchée 60s après `onExpire` si pas d'action

## Ce que je NE ferai pas

- Pas de modification de la logique KelPay elle-même (déjà OK)
- Pas de changement sur les ordres COD ou hors-plateforme
- Pas de raccourcissement du délai initial visible au client (toujours 3 min)
- Aucune suppression d'ordre — uniquement transition vers `payment_failed` (réversible côté admin si besoin)

## Décision attendue

Confirme et je passe en mode default pour :
1. Modifier `expire-pending-orders` (seuil 6 min)
2. Créer `mark-payment-abandoned`
3. Ajouter les listeners client d'abandon
4. Te fournir la migration SQL `cron.schedule` à appliquer en prod

Une question rapide avant : **veux-tu que le seuil serveur soit 6 min (recommandé, agressif) ou 10 min (plus tolérant pour réseaux lents) ?**

