---
name: Lot 18C — Mitigation Realtime + Presence
description: Suite Lot 18B. Réduit la charge realtime.list_changes (80 % du temps DB) et heartbeats de présence (10 %) en passant `use-unread-messages` de Realtime à polling visibility-aware, et en passant les heartbeats de 60 s permanent à 120 s focus / pause si onglet caché. Index partiel ajouté pour la liste produits homepage anon.
type: feature
---

## Lot 18C — Mitigation Realtime + Presence

### Cause initiale (CSV Query Performance prod vpt…yxf)
- `realtime.list_changes` = **80 % du temps DB** (4.17 M calls).
- `update_store_presence` + `update_user_presence` = **10 %** (388 K calls).
- Le hook `use-unread-messages` souscrivait à TOUS les INSERT/UPDATE de la table `messages` sans filtre — multiplié par chaque onglet ouvert.
- Heartbeats de présence : 60 s permanent, sans tenir compte de la visibilité.

### Frontend
- `use-unread-messages.ts` : Realtime → `useVisibilityAwareInterval(30 s focus / 90 s hidden)`.
- `use-user-presence.ts` : 60 s permanent → 120 s focus, **pause complète** si `document.hidden`.
- `useStorePresence.ts` (`useStorePresence` + `useAutoStorePresence`) : idem 120 s focus / pause hidden.
- Seuil "online" lu côté UI passé de **2 min à 5 min** pour matcher le nouveau heartbeat :
  - `StoresPage.tsx` (`ONLINE_WINDOW_MS = 5 * 60 * 1000`)
  - `admin/AdminUsersPage.tsx` (`ONLINE_THRESHOLD`)
- ⚠️ Met à jour `mem://features/real-time-store-presence-indicators` : seuil "actif" = `last_seen_at < 5 min` (et non 2 min).

### Index ajouté (`20260508000000_lot18c_products_published_rating_index.sql`)
- `idx_products_published_rating (rating DESC NULLS LAST, created_at DESC) WHERE publish_status = 'published'` — index partiel, ultra-léger, zéro impact writes.
- Cible la requête anon homepage `WHERE publish_status='published' ORDER BY rating DESC`.

### Realtime conservé (UX critique)
- `ChatPanel` (messagerie vendeur ↔ client)
- `DisputeChat`
- `CheckoutPage` `payment_transactions`
- `PaymentReturnPage`
- `use-rider-location` / `use-customer-location` (tracking GPS)
- `HelpCenterPage` / `AdminSupportPage` / `SupportDrawer` : Realtime conservé car ne s'active QUE quand un ticket est ouvert (concurrence faible).

### Ce qui n'a PAS été fait (rejets motivés)
- Pas de remplacement massif des `select('*')` (189 occurrences) : les hot paths (homepage, notifications, orders) n'utilisent déjà PAS `*`. Toucher les écrans admin = risque de régression > gain.
- Pas d'ajout d'index FK ni de composite indexes supplémentaires : déjà couverts par Lots 17 & 18B (`idx_products_store_status`, `idx_products_status_created`, `idx_orders_store_status`, `idx_orders_status_created`, etc.).

### Procédure de déploiement
1. PR `develop` avec frontend + migration.
2. Migration appliquée manuellement en STAGING via SQL Editor.
3. Smoke test : homepage anon, badge "vendeur en ligne", compteur messages non lus, chat realtime, paiement.
4. Merge `develop → main` après 24 h.
5. Migration appliquée en PROD via SQL Editor (cf. `mem://architecture/rls-staging-prod-divergence`).
6. Re-télécharger le CSV Query Performance 48 h après prod : la part `realtime.list_changes` doit baisser de 80 % à ≈ 50 %, les calls `update_*_presence` divisés par ≈ 4.

### Gain attendu
- Realtime `list_changes` : -30 à -40 % (suppression de la sub globale `unread-counter`).
- Heartbeats présence : -75 % (60 s permanent → 120 s focus + pause hidden).
- Disk IO budget : objectif passer de 5-7 jours à 14-21 jours par cycle.
