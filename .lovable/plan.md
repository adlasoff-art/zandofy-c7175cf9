## Plan — Réduction du Disk IO sur le projet Supabase.com staging (vpt…yxf)

Objectif : faire baisser durablement le Disk IO sans toucher à la production tant que rien n'est validé en staging. Trois axes : audit ciblé, correctifs frontend de polling, migration d'index DB.

### 1. Diagnostic à exécuter sur la base ciblée (script SQL lecture seule)

Tu lanceras ce script dans le SQL Editor de **zandofy-production (staging, vpt…yxf)** pour confirmer les vraies causes avant de rien optimiser à l'aveugle.

Le script fera, en lecture seule :

- top 30 requêtes par temps total (`pg_stat_statements`) ;
- top 30 requêtes par lectures disque (`shared_blks_read`) ;
- top tables par scans séquentiels et tuples lus (`pg_stat_user_tables`) ;
- index inutilisés (`pg_stat_user_indexes` avec `idx_scan = 0`) ;
- jobs `pg_cron` actifs et leur fréquence ;
- taille des tables potentiellement chaudes (`messages`, `notifications`, `orders`, `analytics_events`, `product_views`, `audit_logs`).

Aucune modification, aucun `EXPLAIN ANALYZE` sur table chaude. Le résultat dictera si on doit aller plus loin que les correctifs prévus ci-dessous.

### 2. Correctifs frontend (polling et requêtes coûteuses)

Cibles identifiées dans le code :

```text
src/components/InternalChat.tsx           poll messages toutes les 1,2 s + select *
src/components/messages/ChatPanel.tsx     polling additionnel
src/components/delivery/DeliveryChat.tsx  polling
src/components/OrderAlertListener.tsx     poll orders toutes les 15 s pour tout admin/manager/vendor
src/hooks/use-notifications.ts            poll notifications toutes les 10 s + select *
src/components/NotificationToast.tsx      poll notifications toutes les 10 s (DOUBLON)
src/components/orders/CustomerOrderTracker.tsx  poll toutes les 10 s
src/hooks/use-system-health.ts            select * toutes les 60 s sur 3 vues admin
```

Changements concrets, sans régression fonctionnelle :

1. **InternalChat** : passer le poll de 1,2 s à 3 s quand une conversation est active, 8 s quand l'onglet n'a pas le focus, et stopper net quand `document.hidden`. Restreindre `select *` aux colonnes vraiment affichées (`id, conversation_id, sender_id, body, attachments, created_at, read_at`). Garder le pattern incrémental `gt(created_at)`.
2. **ChatPanel** : aligner sur la même cadence (3 s focus / 8 s hors focus) et même liste de colonnes.
3. **DeliveryChat** : passer à 5 s focus, 15 s hors focus.
4. **NotificationToast vs use-notifications** : supprimer le doublon. Garder un seul poller centralisé dans `use-notifications` (10 s focus, 30 s hors focus), et faire consommer le résultat par `NotificationToast` via le même hook au lieu d'un second `setInterval`.
5. **use-notifications** : remplacer `select("*")` par les colonnes effectivement utilisées.
6. **OrderAlertListener** : passer à 30 s focus / 90 s hors focus, ne lancer que si le rôle est réellement admin/manager/vendor avec stores, et limiter `select` à `order_ref, store_id, total, created_at`.
7. **CustomerOrderTracker** : 15 s focus, stop hors focus.
8. **use-system-health** : conserver 60 s mais cibler les colonnes utilisées par l'UI (pas `select *`) et n'activer le hook que sur les pages admin santé.
9. Ajouter un petit utilitaire `useVisibilityAwareInterval(fn, { activeMs, hiddenMs })` dans `src/hooks/` pour standardiser le pattern focus/hidden, et l'utiliser dans tous les pollers ci-dessus.

Aucune logique métier modifiée. Aucun changement Realtime (la règle « pas de Realtime sur tables sensibles » reste respectée).

### 3. Migration SQL d'index ciblés (staging d'abord)

Fichier : `frontend/supabase/migrations/{timestamp}_perf_disk_io_indexes.sql`. Tous les index en `CREATE INDEX IF NOT EXISTS ... ;` (pas `CONCURRENTLY` car interdit dans les migrations transactionnelles Supabase, on garde la convention du projet).

Index visés, alignés sur les pollers ci-dessus et sur les tables hot connues :

```sql
-- Messages : poll incrémental "WHERE conversation_id = ? AND created_at > ?"
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at DESC);

-- Notifications : poll par user "WHERE user_id = ? ORDER BY created_at DESC"
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Orders alert : "WHERE created_at > cursor [AND store_id IN (...)]"
CREATE INDEX IF NOT EXISTS idx_orders_created
  ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON public.orders (store_id, created_at DESC);

-- Customer order tracker : lookups par order_ref
CREATE INDEX IF NOT EXISTS idx_orders_order_ref
  ON public.orders (order_ref);
```

Procédure :

- exécuter en staging via le SQL Editor (manuellement, comme le hotfix `stores_public`) ;
- vérifier la baisse via le script d'audit (`pg_stat_user_tables` : seq_scan en baisse, `pg_stat_user_indexes` : idx_scan en hausse) sur 24 h ;
- seulement après validation, rejouer **exactement** le même fichier sur production (vpt…yxf) — règle « RLS Staging/Prod Divergence » : on rejoue systématiquement sur les deux.

### 4. Cron jobs DB

- Vérifier dans le résultat du script d'audit si `expire-pending-orders-every-min-staging` (chaque minute) est utile en staging. Si non, le désactiver (`cron.unschedule`) — fichier de désactivation séparé, fourni seulement après ta confirmation.
- Ne pas toucher aux crons production tant que staging n'a pas démontré le gain.

### 5. Ce que je ne ferai pas dans ce lot

- Pas d'upgrade compute. À envisager seulement si après les correctifs et index, la base reste sous pression. Lovable Cloud propose un upgrade d'instance, mais ici la base est sur Supabase.com personnel donc l'upgrade se ferait depuis le dashboard Supabase, pas depuis Lovable.
- Pas de migration de table, pas de partitionnement, pas de purge `analytics_events` ou `audit_logs` tant que le diagnostic ne le démontre pas.
- Pas de changement Realtime.
- Aucun changement appliqué automatiquement en production.

### Livrables après ton approbation

1. Script SQL d'audit lecture seule (`/mnt/documents/audit_disk_io_staging.sql`) à coller dans le SQL Editor staging.
2. Migration `frontend/supabase/migrations/{timestamp}_perf_disk_io_indexes.sql`.
3. Patches frontend : `useVisibilityAwareInterval` + mise à jour des 8 fichiers listés en section 2.
4. Note de vérification (requêtes SQL de contrôle 24 h après application, et procédure de rejeu sur production).

### Ordre d'exécution recommandé

```text
1. Toi : lancer le script d'audit en staging, me coller les résultats.
2. Moi : ajuster les seuils de polling et la liste d'index si l'audit révèle d'autres hotspots.
3. Toi : appliquer la migration d'index en staging via SQL Editor.
4. Toi : merger develop -> main pour déployer les correctifs frontend.
5. Observer 24 h le Disk IO budget en staging.
6. Si OK, rejouer la même migration en production.
```

Confirme et je passe en mode build pour produire les 4 livrables.