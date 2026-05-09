## Problème

Le badge de notifications reste bloqué (ex. 48) même après suppression ou marquage. Le son se déclenche parfois sans changement visible du compteur.

## Cause racine

Dans `frontend/src/hooks/use-notifications.ts`, `unreadCount` est dérivé de la liste locale **limitée à 50** :

```ts
.limit(50);
...
setUnreadCount(items.filter((n) => !n.is_read).length);
```

Conséquences :
1. Si l'utilisateur a >50 non-lues, le compteur plafonne (≈48-50) et ne bouge pas tant qu'on ne descend pas sous 50.
2. Supprimer une notification **lue** ne change pas `unreadCount` → impression de blocage.
3. `NotificationListener` joue un son dès que `unreadCount` augmente. Comme la valeur est tronquée par le LIMIT, des incréments réels peuvent ne pas se refléter (son sans changement de badge).
4. Marquer comme lu côté serveur, puis refetch immédiat, peut ramener la même valeur si la nouvelle non-lue arrive entre temps.

## Correctif

Découpler **liste affichée** (50 dernières) et **compteur réel** (COUNT exact en DB), comme déjà fait dans `use-unread-messages.ts`.

### Changements ciblés

Fichier unique : `frontend/src/hooks/use-notifications.ts`

1. Ajouter une requête HEAD `count: 'exact'` sur `notifications` filtrée par `user_id` + `is_read=false`, exécutée en parallèle de la liste.
2. `setUnreadCount(count ?? 0)` à partir du COUNT, plus du filtre local.
3. Conserver le LIMIT 50 pour la liste affichée (perf Disk IO inchangée).
4. `markAsRead`, `markAllAsRead`, `deleteNotification` : continuer d'appeler `fetchNotifications()` qui re-tire les deux requêtes.
5. Optionnel : optimistic update du compteur dans `markAsRead` (`setUnreadCount(c => Math.max(0, c-1))`) et `markAllAsRead` (`setUnreadCount(0)`) avant le refetch, pour une UX immédiate.

### Détail technique

```ts
const [list, countRes] = await Promise.all([
  supabase.from("notifications")
    .select("id, type, title, message, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50),
  supabase.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false),
]);
setNotifications((list.data || []) as Notification[]);
setUnreadCount(countRes.count ?? 0);
```

## Hors périmètre

- Aucune modification SQL / RLS / Edge Function.
- Pas de changement aux triggers `notify_*` ni au polling adaptatif (10s/30s).
- Pas de retour à Realtime (on reste sur polling, conformément à Lot 18C).

## Vérification

1. Recharger l'app → le badge doit refléter le vrai nombre de non-lues, même au-delà de 50.
2. Marquer une notification comme lue → badge -1.
3. Supprimer une notification non lue → badge -1.
4. Supprimer une notification lue → badge inchangé (comportement attendu).
5. "Tout marquer comme lu" → badge à 0 immédiatement.
