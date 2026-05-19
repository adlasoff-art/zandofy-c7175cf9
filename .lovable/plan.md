# Audit performance — espaces admin / vendeur / livreur

## Diagnostic (faits mesurés dans le code)

### A. Tableau de bord admin (`AdminDashboard` + `*Tab.tsx`)
1. **Aggregations côté client sur tables non bornées.** `OverviewTab`, `SalesTab`, `OrdersTab`, `LogisticsTab`, `VendorsTab`, `ClientsTab` font tous `supabase.from("orders").select("...").gte("created_at", since)` **sans `.limit()`**, puis réduisent en JS. Sur une période 30j en prod (4000+ users/jour), c'est facilement 10–50k lignes par requête, transférées et parsées côté client. C'est la cause n°1 de lourdeur.
2. **`count: "exact"` partout** (38 occurrences). Sur Postgres, `count=exact` force un seq scan complet à chaque appel. Sur `profiles`, `products`, `stores`, `orders`, `messages`, etc. → coût croissant linéaire.
3. **Polling agressif côté admin** : `AdminDashboard` invalide 4 query-keys toutes les **15 s** et 3 autres toutes les **30 s**, même quand l'onglet n'est pas visible. Chaque invalidation relance les sélections lourdes du point 1.
4. **Pas de pagination/cursor sur les listes admin** (Users, Orders, Products, KYB, Disputes…). Première charge = tout le dataset.

### B. Espace vendeur (`VendorDashboardPage.tsx`, 1301 lignes)
1. **N+1 conversations** : pour chaque conversation, 2 requêtes séquentielles (`lastMsg` + `count unread`). 50 conversations = 100 round-trips, séquentiels. C'est l'effet « ça rame quand j'ouvre Messages ».
2. **3 `count exact` sur `orders`** en parallèle au chargement (total / actifs / livrés) sans index dédié filtré.
3. **Composant monolithe** : `VendorDashboardPage` rend tous les onglets dans le même module → bundle énorme téléchargé même pour ouvrir « Messages ».

### C. Espace client (`DashboardPage.tsx`, 2341 lignes)
- Même pathologie : un seul fichier avec tous les onglets (commandes, points, parrainage, paramètres, etc.) chargés ensemble. Bundle initial très lourd pour afficher l'onglet d'accueil.

### D. Layouts (`AdminLayout`, `VendorLayout`…)
- `AdminLayout` est OK (1 requête profile cachée 5 min).
- `SystemHealthWidget` monté sur chaque page admin → vérifier qu'il ne polle pas trop souvent.

### E. Configuration React Query (App.tsx)
- `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false` → bonne base. Rien à changer ici.

---

## Plan d'optimisation (par ordre d'impact)

### Lot 1 — Stopper l'aggregation client sur `orders` (impact ÉNORME)
Remplacer les `select(...).gte("created_at", since)` non bornés par une **RPC d'agrégation côté Postgres**. Une seule fonction `admin_dashboard_overview(since timestamptz, country text, city text)` qui renvoie un JSON avec tous les compteurs/sommes nécessaires à `OverviewTab` (count, revenue, currentRevenue, cancelledRevenue, byStatus, etc.).
- Migration SQL : créer `public.admin_dashboard_overview()` (security definer, vérifie `has_role(auth.uid(),'admin')` ou `'manager'`).
- Faire pareil pour `SalesTab`, `OrdersTab`, `LogisticsTab`, `VendorsTab`, `ClientsTab` (5 RPC, ou une seule `admin_dashboard_metrics(tab, ...)`).
- Côté client : remplacer chaque `useQuery` lourd par `supabase.rpc("admin_dashboard_overview", { ... })`.
- Bénéfice : passage de ~50 k lignes transférées à ~1 KB JSON par onglet, latence × 10–50.

### Lot 2 — Bannir `count: "exact"` sur grosses tables
- Remplacer par `count: "estimated"` (utilise les stats Postgres) ou par la même RPC ci-dessus qui renvoie le compteur calculé.
- Cibles prioritaires : `profiles`, `products`, `stores`, `orders`, `messages`, `notifications`.

### Lot 3 — Polling intelligent (`AdminDashboard`)
- Passer le polling 15 s → **45 s** par défaut, et le 30 s → **90 s**.
- Ajouter un gate `document.visibilityState === 'visible'` pour stopper le polling quand l'onglet est en arrière-plan (déjà fait pour certaines pages via `useVisibilityAwareInterval` — réutiliser ici).
- Bénéfice : −66 % de requêtes inutiles et le navigateur ne pédale plus quand l'admin est sur un autre onglet.

### Lot 4 — Fix N+1 conversations vendeur (`VendorDashboardPage`)
- Une seule requête sur `messages` : `SELECT conversation_id, max(created_at) FROM messages WHERE conversation_id IN (...) GROUP BY ...` pour le `lastMsg`, puis une requête agrégée pour les unread counts (`SELECT conversation_id, count(*) ... WHERE is_read=false AND sender_id<>$user GROUP BY conversation_id`).
- Ou créer une vue `v_vendor_conversation_summary(store_id)` qui renvoie déjà `last_message_content`, `unread_count`, `customer_email`, `product_name`.
- Bénéfice : 100 round-trips → 2 requêtes.

### Lot 5 — Découpe des dashboards monolithes
- `VendorDashboardPage` (1301 l) et `DashboardPage` (2341 l) : extraire chaque onglet dans un fichier propre et le charger via `React.lazy()` lorsqu'on clique sur l'onglet.
- Bénéfice : bundle initial du dashboard divisé par 3–5, TTI plus rapide.

### Lot 6 — Pagination cursor sur listes admin (Users, Orders, Products, KYB, Disputes)
- Ajouter `.range(from, to)` + UI pagination ou infinite scroll.
- Désactiver `count: "exact"` côté liste (afficher « 1–50 sur 1k+ » via estimated).

### Lot 7 — Indexes Postgres (à valider en SQL audit)
- Vérifier l'existence de `CREATE INDEX ON orders (created_at DESC)`, `ON orders (store_id, status)`, `ON messages (conversation_id, created_at DESC)`, `ON messages (conversation_id, is_read) WHERE is_read=false`. Créer ceux qui manquent via migration.

---

## Détails techniques

- **Périmètre** : `frontend/src/pages/admin/AdminDashboard.tsx`, `frontend/src/components/admin/dashboard/*Tab.tsx`, `frontend/src/pages/VendorDashboardPage.tsx`, `frontend/src/pages/DashboardPage.tsx`, plus migrations SQL pour les RPC et indexes.
- **Migrations SQL** : nouvelles, jamais d'édition d'anciennes (cf. règles projet). Déploiement prod via GitHub Actions.
- **Sécurité** : toutes les RPC `security definer` + `has_role(auth.uid(), 'admin'|'manager')` avant exécution, `search_path = public`. Pas de modification des schémas `auth/storage/realtime`.
- **Memory de référence** : `mem://architecture/cache-management-strategy`, `mem://features/analytics-dashboard-v2` (déjà partiellement appliqué côté analytics pro — étendre la même approche RPC).
- **Validation** : DevTools Network → la requête `admin_dashboard_overview` doit revenir < 500 ms avec quelques Ko de payload ; plus de requête `/orders?select=...` retournant > 1 MB.

## Suggestion d'ordre d'exécution

Je propose de commencer par **Lots 1 + 3 + 4** (impact immédiat, faible risque) et de traiter 2/5/6/7 en passes séparées. Confirme-moi par lequel tu veux que je commence, ou si je dois enchaîner les trois d'un bloc. Si tu valides « tout Lot 1+3+4 », je crée la migration SQL + les RPC + remplace les requêtes côté React dans la foulée.
