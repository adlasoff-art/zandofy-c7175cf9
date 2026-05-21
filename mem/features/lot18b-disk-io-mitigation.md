---
name: Lot 18B — Mitigation Disk IO
description: Polling adaptatif (visibility-aware) sur chat/notifications/orders/tracking + indexes ciblés (messages, notifications, orders, delivery_chats) pour absorber l'alerte Supabase Disk IO budget.
type: feature
---

## Lot 18B — Mitigation Disk IO staging/prod

### Cause initiale
- Polling agressif `InternalChat` à 1.2 s + `select *` sur `messages`.
- Doublon de polling sur `notifications` (`use-notifications` 10 s + `NotificationToast` 10 s).
- `OrderAlertListener` polling 15 s pour tout admin/manager/vendor connecté.
- Aucun arrêt du polling lorsque l'onglet n'avait pas le focus.
- Indexes manquants pour les patterns "WHERE x = ? AND created_at > cursor".

### Frontend
- Nouveau hook `src/hooks/use-visibility-aware-interval.ts` :
  `useVisibilityAwareInterval(fn, { activeMs, hiddenMs, enabled, runImmediately?, runOnFocus? })`.
  Stoppe ou ralentit le polling quand `document.hidden`, re-fire au focus.
- `use-notifications` : 10 s focus / 30 s hidden, colonnes ciblées (plus de `select *`).
- `NotificationToast` : ne fait plus son propre polling, consomme `useNotifications` (suppression du doublon).
- `InternalChat` : 3 s focus / 8 s hidden, colonnes ciblées + curseur `gt(created_at)` conservé.
- `OrderAlertListener` : 30 s focus / 90 s hidden, vendeur sans store ⇒ aucune requête, `limit(20)`.
- `CustomerOrderTracker` : 15 s focus, **stop** si onglet caché.
- `DeliveryChat` : 5 s focus / 15 s hidden.
- `ChatPanel` (messages internes vendeur ↔ client) : intentionnellement laissé sur Realtime (déjà en place, pas de polling) — pas de changement.

### Indexes ajoutés (`20260501100000_perf_disk_io_indexes.sql`)
- `idx_messages_conv_created (conversation_id, created_at DESC)`
- `idx_notifications_user_created (user_id, created_at DESC)`
- `idx_notifications_user_unread (user_id) WHERE is_read = false` (partiel)
- `idx_orders_created (created_at DESC)`
- `idx_orders_store_created (store_id, created_at DESC)`
- `idx_orders_order_ref (order_ref)`
- `idx_delivery_chats_order_created (order_id, created_at)`

Tous en `CREATE INDEX IF NOT EXISTS` (idempotent, pas de `CONCURRENTLY` car
interdit dans une migration transactionnelle Supabase).

### Procédure de déploiement
1. Exécuter le script `audit_disk_io_staging.sql` (lecture seule) sur staging
   pour confirmer les hotspots avant/après.
2. Appliquer la migration manuellement via SQL Editor sur **staging** d'abord.
3. Observer 24 h le Disk IO budget.
4. Rejouer **exactement** le même fichier sur **production** (vpt…yxf).
   Voir `mem://architecture/rls-staging-prod-divergence`.

### Ce qui n'a PAS été fait
- Pas de modification Realtime (règle "no realtime on sensitive tables" préservée).
- Pas d'upgrade compute. À envisager seulement si la pression persiste.
- Pas de purge `analytics_events` / `audit_logs` — à décider après audit.
- Cron `expire-pending-orders-every-min-staging` (1/min) : à évaluer après audit ;
  pas de désactivation auto.