# Correctifs erreurs console prod

## Diagnostic

Deux erreurs distinctes (les warnings "preload not used" sont une conséquence, pas la cause).

### 1. `401` sur `/rest/v1/cms_banners` (depuis `index.html`)

Le script inline dans `frontend/index.html` (lignes 73-91) fait un `fetch()` direct vers Supabase avec une **clé anon hardcodée** :

```
KEY = 'eyJ...iat:1750161437...' (juin 2025)
```

Cette clé est figée dans le HTML — elle ne suit pas `VITE_SUPABASE_PUBLISHABLE_KEY` qui est injectée au build via Vercel. Si la clé anon prod a été rotée (ou si la valeur déployée diffère), l'inline fetch échoue en 401 alors que le bundle React continue de fonctionner avec la bonne clé.

→ **Conséquence visible** : aucune (le composant `HeroBanner` re-fetch correctement), mais ça pollue la console et casse le préchargement LCP.

### 2. `400` sur `/rest/v1/profiles?select=created_at,residence_country,residence_city`

Les colonnes `residence_country` et `residence_city` **n'existent pas** dans la table `profiles` côté prod (`vpttoqojmiqxgudknyxf`). Elles sont référencées dans :
- `frontend/src/hooks/use-automation.ts` (l.99-109) — appelé par les workflows marketing
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/admin/AdminNotificationsPage.tsx`
- `frontend/src/components/admin/UserDetailDrawer.tsx`

Soit la migration qui ajoute ces colonnes n'a jamais été déployée en prod, soit le code a été écrit en anticipation. Cas typique de divergence schéma staging/prod déjà documenté en mémoire (`rls-staging-prod-divergence`).

→ **Conséquence visible** : le hook `useAutomation` lève une erreur en boucle côté client → bruit console + workflows marketing partiellement cassés.

---

## Plan d'exécution

### Phase 1 — Stopper la fuite (front, sans toucher au schéma)

**Fichier `frontend/index.html`** — supprimer la dépendance à la clé hardcodée :

Deux options possibles, je recommande **l'option B** (plus simple, zéro régression) :

- **Option A** : injecter la clé anon au build via un placeholder remplacé par Vite (ex. `__VITE_SUPABASE_ANON__`). Plus propre mais nécessite un plugin Vite ou un `transformIndexHtml`.
- **Option B (recommandée)** : **retirer le bloc B** (fetch direct cms_banners depuis index.html). Garder le bloc A (preload depuis `localStorage.z_lcp_hero_url`) qui couvre 95 % des visites récurrentes. `HeroBanner.tsx` continue de remplir le cache après le premier rendu. On perd ~200 ms de LCP sur la **toute première visite** d'un nouveau visiteur, mais on élimine la dette de la clé hardcodée.

**Fichier `frontend/src/hooks/use-automation.ts`** — rendre la query tolérante :

Wrapper le `select("created_at, residence_country, residence_city")` :
1. Essayer d'abord les 3 colonnes.
2. Si erreur PostgREST `42703` (colonne inexistante) → fallback `select("created_at")` et laisser `userCountry`/`userCity` à `null`.
3. Ne **pas** propager l'erreur (les workflows marketing doivent dégrader gracieusement).

Pareil dans les 3 autres fichiers qui sélectionnent ces colonnes — audit rapide pour décider entre tolérance ou suppression du champ selon que l'UI affiche la donnée ou non.

### Phase 2 — Réconcilier le schéma prod (DB)

Créer une migration `frontend/supabase/migrations/{ts}_profiles_residence_columns.sql` :

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS residence_country text,
  ADD COLUMN IF NOT EXISTS residence_city text;
```

À déployer en prod via GitHub Actions (`deploy-edge-functions.yml` n'applique que les edges — vérifier qu'un workflow `supabase db push` tourne sur `main`, sinon appliquer manuellement via le pipeline existant).

Une fois la migration en prod, retirer le fallback de tolérance ajouté en Phase 1 (ou le laisser comme garde-fou, peu coûteux).

### Phase 3 — Vérification

1. Build local : `bun run build` → vérifier qu'aucune référence à la clé hardcodée ne reste.
2. Déployer staging → ouvrir `/` puis `/dashboard` → console propre (0 erreur 400/401, 0 warning preload).
3. Vérifier que `HeroBanner` s'affiche normalement et que `z_lcp_hero_url` est rempli après 1 visite.
4. Puis prod.

---

## Fichiers touchés

- `frontend/index.html` (retrait bloc B)
- `frontend/src/hooks/use-automation.ts` (tolérance schéma)
- `frontend/src/pages/DashboardPage.tsx` (audit)
- `frontend/src/pages/admin/AdminNotificationsPage.tsx` (audit)
- `frontend/src/components/admin/UserDetailDrawer.tsx` (audit)
- `frontend/supabase/migrations/{ts}_profiles_residence_columns.sql` (nouveau)

## Hors scope

- Rotation de clé anon (si c'est la cause réelle du 401, à confirmer avec toi).
- Refonte du LCP preload via injection Vite (à faire dans un second temps si on veut récupérer les ~200 ms de la première visite).
