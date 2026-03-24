

## Plan : Terminer la Phase 1 — 5 fonctionnalités incomplètes

Après audit du code, voici les 5 éléments commencés mais non terminés, et ce qu'il faut faire pour chacun.

---

### 1. Emails transactionnels automatiques sur changement de statut commande

**État actuel** : L'edge function `notify-order-status` existe et peut envoyer des emails + notifications in-app + push. Mais elle n'est **jamais appelée** depuis le frontend.

**À faire** :
- Dans `VendorOrderManager.tsx`, après chaque changement de statut réussi (confirmed, in_shipping, shipped, delivered), appeler `supabase.functions.invoke("notify-order-status", { body: { orderId, newStatus } })`
- Dans les pages admin où le statut peut être changé, ajouter le même appel
- Ajouter les statuts manquants dans la map `NOTIFY_STATUSES` de l'edge function : `delivered`, `out_for_delivery`

| Fichier | Changement |
|---------|-----------|
| `frontend/src/components/vendor/VendorOrderManager.tsx` | Appel notify-order-status après mise à jour statut |
| `frontend/supabase/functions/notify-order-status/index.ts` | Ajouter statuts `delivered`, `out_for_delivery` |

---

### 2. pg_cron pour expiration automatique des commandes

**État actuel** : L'edge function `expire-pending-orders` existe et fonctionne. Mais le cron job n'est peut-être pas configuré en production.

**À faire** :
- Fournir le SQL exact pour créer le cron job via `pg_cron` + `pg_net`
- Le configurer via l'outil SQL (pas migration, car contient des données spécifiques au projet)

**SQL à exécuter** :
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'expire-pending-orders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uogkklwfvwoxkifpkzpu.supabase.co/functions/v1/expire-pending-orders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2trbHdmdndveGtpZnBrenB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODY0MzcsImV4cCI6MjA4NzQ2MjQzN30.9NhIOytfsQ7Gdufs0goV6Lk97IyMkda362jh3IGMVi4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

### 3. Visual Search — connecter le frontend à l'edge function Lovable Cloud

**État actuel** : `PredictiveSearch.tsx` a déjà un bouton caméra et un modal de visual search. L'edge function `visual-search` existe dans deux emplacements (`supabase/functions/` et `frontend/supabase/functions/`). Il faut vérifier que le frontend appelle bien l'edge function Lovable Cloud (pas l'ancien backend FastAPI).

**À faire** :
- Vérifier que `PredictiveSearch.tsx` utilise `supabase.functions.invoke("visual-search")` et non l'ancien `apiFetch`
- S'assurer que la config.toml a `verify_jwt = false` pour visual-search (déjà fait)
- Tester le flux complet

| Fichier | Changement |
|---------|-----------|
| `frontend/src/components/PredictiveSearch.tsx` | Vérifier/corriger l'appel vers edge function |

---

### 4. Push Notifications — abonnement frontend

**État actuel** : L'edge function `push-notifications` existe avec les VAPID keys configurées. Mais **aucun code frontend** ne demande la permission, n'enregistre le service worker, ni ne sauvegarde l'abonnement en base.

**À faire** :
- Créer un hook `usePushNotifications` qui :
  - Demande la permission notification
  - Enregistre le service worker
  - Obtient l'abonnement PushSubscription
  - Sauvegarde endpoint/p256dh/auth dans `push_subscriptions`
- Créer un composant `PushPermissionPrompt` qui s'affiche une fois pour les utilisateurs connectés
- Intégrer dans `DashboardPage.tsx` ou `App.tsx`

| Fichier | Action |
|---------|--------|
| `frontend/src/hooks/use-push-notifications.ts` | Créer — hook d'abonnement push |
| `frontend/src/components/PushPermissionPrompt.tsx` | Créer — UI demande permission |
| `frontend/src/pages/DashboardPage.tsx` | Intégrer le prompt |
| `frontend/public/sw-push.js` | Créer — service worker pour recevoir les notifs push |

---

### 5. Paiement par carte — Intégration Stripe

**État actuel** : Un message "Ce moyen de paiement n'est pas actif" s'affiche. Aucune intégration réelle.

**À faire** :
- Activer Stripe via l'outil Lovable Stripe
- Créer une edge function `create-checkout-session` pour générer une session Stripe Checkout
- Modifier `CheckoutPage.tsx` pour proposer Stripe quand la carte est activée dans `platform_settings`
- Gérer le webhook de confirmation (marquer la commande comme `confirmed`)

| Fichier | Action |
|---------|--------|
| Edge function `create-stripe-session` | Créer — session Stripe Checkout |
| Edge function `stripe-webhook` | Créer — callback Stripe |
| `frontend/src/pages/CheckoutPage.tsx` | Intégrer le bouton payer par carte |

**Note** : Cette étape nécessite d'abord d'activer Stripe (clé API). Je demanderai confirmation avant de procéder.

---

### Ordre d'implémentation

1. **Emails transactionnels** (rapide, juste brancher les appels)
2. **pg_cron** (SQL à exécuter manuellement)
3. **Visual Search** (vérification + correction si nécessaire)
4. **Push Notifications** (nouveau code frontend)
5. **Stripe** (nécessite activation préalable)

### Résumé : ~10 fichiers modifiés/créés

