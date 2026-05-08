# Optimisation Disk IO — Production (vpt…yxf)

Analyse du CSV `Query Performance` que tu as fourni : les vrais hotspots ne sont **pas** des seq scans manquants d'index — la plupart des index nécessaires existent déjà (Lots 17 & 18B). Le coupable réel :

| Source | Part du temps DB | Calls |
|---|---|---|
| `realtime.list_changes` (postgres_changes) | **~80%** | 4.17 M |
| `update_store_presence` + `update_user_presence` | **~10%** | 388 K |
| Polling `notifications` | ~2% | 459 K |
| Liste produits homepage (anon, ORDER BY rating) | ~1% | 8.4 K |
| Reste | ~7% | — |

Le prompt de Gemini se concentre sur les index — ils sont déjà bons. Je le complète avec les **vrais leviers**, **sans casser aucune fonctionnalité métier**.

---

## Lot A — Realtime : retirer les abonnements remplaçables par polling (gros gain, zéro risque métier)

14 subscriptions `postgres_changes` ouvertes côté frontend. Chacune contribue à `list_changes` qui consomme 80% du temps DB (les utilisateurs gardent ces onglets ouverts).

**On garde Realtime (UX critique) :**
- `ChatPanel` (messagerie vendeur ↔ client) — instantané requis
- `DisputeChat` — instantané requis
- `CheckoutPage` `payment_transactions` — confirmation paiement live
- `PaymentReturnPage` — confirmation paiement live
- `use-rider-location` / `use-customer-location` — tracking GPS live

**On bascule sur polling visibility-aware (`useVisibilityAwareInterval` déjà existant, cf. Lot 18B) :**
- `use-unread-messages` → 30s focus / 90s hidden
- `HelpCenterPage` (support tickets) → 20s focus / 60s hidden
- `AdminSupportPage` → 20s focus / 60s hidden
- `SupportDrawer` → 20s focus / 60s hidden

Gain attendu : **~30–40% de la charge `realtime.list_changes`** (les chats/paiements restent en realtime).

---

## Lot B — Presence : réduire la fréquence des heartbeats

Actuellement : `update_store_presence` + `update_user_presence` toutes les **60 s** sans tenir compte de la visibilité de l'onglet. Pour un user avec 1 store collaborateur ouvert 8 h/jour = 960 RPC/jour/user.

Changements :
1. Heartbeat **toutes les 120 s** quand l'onglet est focus.
2. **Stop complet** quand l'onglet est `document.hidden` (le `set_*_offline` sera appelé par le `beforeunload` ou par expiration côté serveur — la logique "online si `last_seen_at < 2 min`" reste cohérente, on passe juste le seuil métier de 2 → 5 min).
3. Pas de changement métier : `useStorePresence`, `useAutoStorePresence`, `useUserPresence` gardent la même API publique.

⚠️ **Validation utilisateur requise** : le seuil "actif si `last_seen_at < 2 min`" est documenté dans `mem://features/store-location-and-navigation`. On le déplace à **5 min** pour matcher le nouveau heartbeat 120 s. Confirme que ça reste acceptable côté UX (le badge "vendeur en ligne" pourra rester vert jusqu'à 5 min après fermeture de l'onglet).

Gain attendu : **~50% de la charge presence** (≈ -5% du temps DB total).

---

## Lot C — Index ciblé liste produits homepage (anon)

La requête anon homepage `WHERE publish_status = 'published' ORDER BY rating DESC LIMIT 20` n'a pas d'index dédié (on a `(publish_status, created_at DESC)` mais pas `(publish_status, rating DESC)`).

Migration (idempotente, à appliquer en STAGING puis PROD) :

```sql
CREATE INDEX IF NOT EXISTS idx_products_published_rating
  ON public.products (publish_status, rating DESC NULLS LAST)
  WHERE publish_status = 'published';
```

Index partiel → minuscule, zéro impact sur les writes. Aucun risque métier.

---

## Lot D — Hygiène `select('*')` sur les hot paths uniquement

189 occurrences de `.select('*')` dans le code. **On ne touche PAS à toutes** (risque de régression élevé — tu dépends souvent des champs implicites côté admin/dashboard).

On cible **uniquement** les hot paths confirmés par le CSV ou par la fréquence d'appel :
- `use-vendor-subscription` (appelé sur chaque page vendeur)
- `use-operator-context` (appelé sur chaque page opérateur)
- `useOperatorQuotes` (checkout)
- `use-system-health` (admin polling)

Pour chacun : remplacer `*` par la liste explicite des colonnes effectivement lues dans le composant consommateur. Aucune logique métier touchée.

⚠️ **On NE touche PAS** aux pages admin de gestion (Withdrawals, VendorSubscriptions, etc.) — trop de risques de manquer un champ utilisé en édition.

---

## Lot E — Vérifications post-déploiement

1. Audit Realtime : `SELECT count(*) FROM realtime.subscription;` avant/après → doit baisser.
2. Audit presence : compter les calls `update_*_presence` sur 24 h → doit être divisé par ~4 (60 s focus → 120 s focus + stop hidden).
3. Re-télécharger un CSV `Query Performance` 48 h après prod → la part `realtime.list_changes` doit passer de 80% à ~40–50%.
4. PageSpeed mobile/desktop inchangé (ces optims sont DB-only, n'impactent pas le bundle frontend).

---

## Procédure de déploiement (respect strict de `mem://architecture/rls-staging-prod-divergence`)

1. PR `develop` avec : code frontend (Lots A, B, D) + migration `frontend/supabase/migrations/` (Lot C).
2. Migration appliquée manuellement en **STAGING** via SQL Editor → smoke test (homepage anon, présence vendeur, chat, support).
3. Merge `develop → main` après 24 h d'observation staging.
4. Migration appliquée en **PROD** via SQL Editor.
5. Surveillance Disk IO budget pendant 7 jours.

---

## Ce que je NE ferai PAS (et pourquoi)

| Suggestion Gemini | Verdict | Raison |
|---|---|---|
| Index sur `is_active, created_at DESC` | ❌ | Pas de colonne `is_active` chez nous, c'est `publish_status`. Index déjà présent. |
| Index sur tous les FK | ✅ Déjà fait | `idx_products_supplier_id`, `idx_orders_freight_quote`, `idx_orders_delivery_operator`, etc. existent déjà (Lot 17). |
| Remplacer **tous** les `select('*')` | ❌ | Risque de casser des écrans admin qui lisent des colonnes implicites. On cible uniquement les hot paths. |
| Pagination forcée partout | ❌ | Déjà en place (limit/offset PostgREST) sur les listes admin. Forcer ailleurs casserait les exports. |

---

## Question pour toi avant que je code

Le seul changement métier visible est le **passage du seuil "vendeur en ligne" de 2 min → 5 min** (Lot B) pour permettre de réduire le heartbeat. Tu valides ?

Si oui, je commence par : Lot C (migration SQL pour ta revue) → puis Lots A, B, D côté frontend.
