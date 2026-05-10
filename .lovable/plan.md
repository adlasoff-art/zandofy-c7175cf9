# Plan d'exécution — Push Notifications + Nettoyage + Audit

Bien noté : workflow direct sur `main` accepté, migrations SQL manuelles sur staging+prod, Edge Functions auto via GitHub Actions. Paiement carte reporté à une itération suivante.

---

## Lot 1 — Push Notifications mobiles (Phase 1 + Phase 2)

### Diagnostic confirmé
- VAPID configuré, `push_subscriptions` peuplée, SW enregistré ✅
- **Aucun push réel n'est envoyé** : les Edge Functions (`notify-order-status`, `process-automation`, etc.) lisent les souscriptions mais ne font qu'un `console.log`. Pas d'appel HTTP vers les endpoints push (FCM/APNs/Mozilla).
- Conséquence : sur mobile fermée → **rien**. Sur desktop, le navigateur ouvert affiche les notifs in-app via polling, ce qui crée l'illusion que ça marche.

### Phase 1 — Activer le Web Push réel

**1.1 Centraliser l'envoi dans une fonction unique**
- Créer `frontend/supabase/functions/send-web-push/index.ts`
- Implémentation avec `jsr:@negrel/webpush@0.5.0` (déjà dépendance dans `push-notifications/index.ts`)
- Signature : `{ user_ids: string[], title, body, url?, icon?, badge?, tag? }`
- Logique : récupérer les souscriptions actives → signer JWT VAPID → POST vers chaque endpoint → nettoyer les souscriptions retournant 404/410
- CORS strict + `verify_jwt = true` + service role pour DB

**1.2 Brancher sur les triggers existants**
- `notify-order-status` : appel après l'envoi email (statuts : confirmed, shipped, out_for_delivery, delivered, off_platform_validated)
- `notify-sourcing-response` : confirmé par le test email du jour ✅
- `notify-operator-new-order` : nouvelle commande livreur
- `notify-forwarder-handoff` + `notify-handoff-status-customer` : étapes hub
- `process-automation` : campagnes marketing
- Chat messages (table `messages`) : trigger DB → invocation `send-web-push`

**1.3 Améliorer le Service Worker `sw-push.js`**
- Ajouter `requireInteraction: true` pour notifications critiques (commandes)
- Ajouter `tag` pour regrouper les notifs (évite spam)
- Ajouter `silent: false` explicite pour forcer le son
- Gérer `actions` cliquables (Voir / Marquer lu)
- Sur réception : appeler `setAppBadge()` (Phase 2)

**1.4 Diagnostiquer pourquoi mobile ne reçoit rien actuellement**
- Vérifier que `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` sont bien configurés en prod (sinon `push-notifications` retourne `vapid_keys_missing`)
- Vérifier que la souscription mobile est bien enregistrée dans `push_subscriptions` (table prod)
- Vérifier que le manifest PWA permet l'installation iOS 16.4+ (`display: standalone`, `start_url`)

### Phase 2 — Badging API (pastille icône)

**2.1 Service Worker**
- Sur `push` event → calculer `unread_count` via fetch authentifié → `navigator.setAppBadge(count)`
- Sur `notificationclick` → `navigator.clearAppBadge()` si toutes lues

**2.2 Côté app**
- Hook `useNotifications` → appeler `setAppBadge(unreadCount)` à chaque update
- Sur `markAllAsRead` → `clearAppBadge()`
- Compatibilité : Chrome Android, iOS 16.4+ PWA installée, Edge desktop, Windows
- Fallback graceful si `setAppBadge` non dispo

### Tests prévus (sans paiement)
1. Chrome desktop : abonnement → trigger commande → notif système + son ✅
2. Android Chrome PWA installée → notif arrive app fermée
3. iOS 16.4+ Safari → ajouter à l'écran d'accueil → notif arrive app fermée
4. Pastille `setAppBadge` visible sur icône Android/iOS

---

## Lot 2 — Nettoyage SMTP / Hostinger

### Secrets à supprimer (manuel par toi)
Dans Supabase prod (`vpt...yxf`) **et** staging :
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_PORT` si présent

À conserver : `SMTP_FROM_EMAIL`, `RESEND_API_KEY`.

### Code
Aucune ref résiduelle à `nodemailer` dans les Edge Functions actives ✅. Rien à supprimer côté code applicatif.

---

## Lot 3 — Audit code mort

Tenant compte de tes précisions (workflow direct main, migrations manuelles, edge functions auto), je vais produire un **rapport listé** sans rien supprimer. Catégories :

**3.1 Doublons de structure**
- `supabase/functions/` racine (35 fonctions) vs `frontend/supabase/functions/`. Le workflow déploie depuis `frontend/` → racine non déployée. Ai-je raison ? À reconfirmer ensemble.
- `src/` racine, `vite.config.ts` racine, `tailwind.config.ts` racine, `index.css` racine vs `frontend/src/...` → résidus de la séparation monorepo

**3.2 Edge Functions potentiellement obsolètes**
À vérifier appel par appel (frontend + cron) :
- `kelpay-callback` vs `kelpay-webhook`
- `process-automation-workflows` vs `process-automation`
- `ai-user-analysis`
- `expire-pending-orders` + `mark-payment-abandoned` (cron actifs ?)

**3.3 Composants React non importés**
Scan via `knip` ou `ts-prune` → liste des fichiers à 0 import.

**3.4 Tables / vues SQL non référencées**
Cross-check `pg_stat_user_tables` + grep code → propositions de DROP.

### Livrable
Rapport markdown `/AUDIT-DEAD-CODE.md` avec preuve d'absence d'usage pour chaque entrée. **Aucune suppression sans validation explicite ligne par ligne.**

---

## Lot 4 (différé) — Paiement carte « missing parameter »
Reporté. Quand on s'y attaquera : capture des logs `keccel-cardpay` prod + comparaison payload vs doc Cassel + vérif secrets `SITE_BASE_URL` / `KECCEL_CARD_MERCHANT_CODE` / `KELPAY_TOKEN`.

---

## Section technique

**Fichiers créés / modifiés (Lot 1) :**
- ➕ `frontend/supabase/functions/send-web-push/index.ts`
- ➕ `frontend/supabase/functions/send-web-push/deno.json`
- ✏️ `frontend/public/sw-push.js` (badging + actions + tag)
- ✏️ `frontend/supabase/functions/notify-order-status/index.ts`
- ✏️ `frontend/supabase/functions/notify-operator-new-order/index.ts`
- ✏️ `frontend/supabase/functions/notify-sourcing-response/index.ts`
- ✏️ `frontend/supabase/functions/notify-forwarder-handoff/index.ts`
- ✏️ `frontend/supabase/functions/notify-handoff-status-customer/index.ts`
- ✏️ `frontend/supabase/functions/process-automation/index.ts`
- ✏️ `frontend/src/hooks/use-notifications.ts` (badging API)
- ✏️ `frontend/supabase/config.toml` (ajout entrée `[functions.send-web-push] verify_jwt = true`)

**Migrations SQL (Lot 1) :** aucune. Table `push_subscriptions` déjà existante.

**Vérifications avant push :**
- Confirmer présence prod de `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
- Confirmer présence d'un `VAPID_SUBJECT` (`mailto:contact@zandofy.com`) — requis par la spec WebPush

**Coût total :** 0 € (VAPID = direct vers FCM/APNs/Mozilla, gratuit illimité).

---

## Ordre d'exécution proposé

1. **Lot 1 Phase 1** (Web Push réel) — bloquant business, impact maximum
2. **Lot 1 Phase 2** (Badging API) — UX
3. **Lot 2** (nettoyage secrets SMTP) — 5 min, à faire par toi côté Supabase
4. **Lot 3** (audit) — rapport seul, suppressions ensuite
5. **Lot 4** plus tard (paiement carte)

---

## À valider avant que je passe en mode build

- OK pour créer `send-web-push` comme fonction unifiée plutôt que de dupliquer la logique webpush dans chaque function ?
- Tu confirmes que `VAPID_SUBJECT` est configuré en prod ? Si non, je le demanderai via `add_secret` au début de l'implémentation.
- Tu valides l'ordre 1 → 2 → 3 ?