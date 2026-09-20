# Incident immédiat — Homepage skeleton / Supabase 503

**Statut :** runbook ops (pas un deploy frontend)  
**Projet prod :** `vpttoqojmiqxgudknyxf` (`https://vpttoqojmiqxgudknyxf.supabase.co`)  
**Preuve logs :** 2026-09-02 ~10:29–10:31 UTC  

---

## 1. Diagnostic (déjà confirmé)

| Observation | Signification |
|-------------|---------------|
| Header OK, hero/catégories skeleton | Vercel OK, **API Supabase KO** |
| `GET …/categories` **503** | PostgREST ne peut pas servir (DB saturée) |
| `GET …/cms_banners` **503** | Idem → skeleton permanent `HeroBanner` |
| `GET …/products_public` **503** | Catalogue KO |
| `POST /auth/v1/token` **504** | Auth timeout (dépend de la DB) |
| Postgres `57014` statement timeout | Requêtes trop longues / contention |
| `cron job N job startup timeout` | Crons qui n’arrivent plus à démarrer → boucle de charge |
| Checkpoint ~68 s | Pression I/O disque |

**Cause :** saturation Postgres prod, pas un bug de layout React.

---

## 2. Correctif immédiat (ordre strict)

Ouvrir : **Supabase Dashboard → projet prod `vpttoqojmiqxgudknyxf` → SQL Editor**.

Fichier SQL prêt à coller par phases :

`supabase/migrations/MANUAL_incident_503_emergency_prod.sql`

### Étape 1 — Phase A (diagnostic)

Exécuter **PHASE A** seule. Noter :

- `active` backends élevés ?
- requêtes `duration` > 30–60 s ?
- liste `cron.job` (surtout schedule `* * * * *`)
- lignes `job startup timeout` dans `cron.job_run_details`

### Étape 2 — Phase B (kill)

Si A2 montre des requêtes bloquées > 60 s :

1. Décommenter **B2** → lister les PID  
2. Décommenter **B3** / **B4** → `pg_terminate_backend`

Ne pas tuer au hasard sans avoir lu B2.

### Étape 3 — Phase C (pause crons) — **prioritaire**

```sql
UPDATE cron.job SET active = false;
```

(déjà dans le fichier, Phase C2)

Ça coupe immédiatement la boucle « cron startup timeout » vue dans les logs.

### Étape 4 — Vérifier le site

1. Attendre 30–60 s  
2. Hard refresh `https://www.zandofy.com` (Ctrl+Shift+R)  
3. Network : `categories` + `cms_banners` + `products_public` → **200**  
4. Exécuter **PHASE D** (EXPLAIN ANALYZE) — objectif < 2 s

### Étape 5 — Phase E (réactiver crons)

1. **PHASE E1** : identifier les jobs `* * * * *`  
2. Réactiver d’abord horaires / quotidiens (**E2**)  
3. Laisser OFF les jobs chaque minute jusqu’à audit (**E3**)  
4. **E4** : si `command` contient `wgidwyrdnboivfphwete` ou `uogkklwfvwoxkifpkzpu` alors que vous êtes sur prod `vpttoqoj…` → **ne pas réactiver** ; corriger l’URL vers prod

### Étape 6 — Dashboard Supabase (parallèle)

Pendant/après le SQL :

1. **Database → Reports** : CPU, Memory, Disk I/O, connections  
2. Si CPU/Disk restent à 100 % → upgrade compute temporaire ou support Supabase  
3. **Settings → Database** : vérifier taille du plan / pooler  
4. Edge Functions : pas de redeploy obligatoire pour ce correctif

---

## 3. Smoke test post-incident

| Check | Attendu |
|-------|---------|
| Accueil hero | Images + titres CMS |
| Cercles catégories | Remplis |
| Soldes / grille produits | Cartes visibles |
| Login / refresh session | Plus de 504 sur `/auth/v1/token` |
| Admin CMS bannières | Lecture OK |

---

## 4. Si ça ne remonte pas après C

1. Support Supabase (projet Pro) — « sustained 503 + statement timeout + cron startup timeout »  
2. Vérifier **maintenance mode** / incident status.supabase.com  
3. Temporaire : page maintenance Cloudflare (si vraiment offline > 15 min)  
4. Ne **pas** lancer de gros `DELETE` / `VACUUM FULL` pendant l’incident

---

## 5. Après stabilisation (même jour, hors pic)

| Action | Pourquoi |
|--------|----------|
| Auditer jobs `* * * * *` | Suspect n°1 des « job startup timeout » en boucle |
| Corriger URLs cron (prod vs staging) | Migrations repo pointent parfois vers `uogkkl…` |
| Batch cleanup `analytics_events` (Phase F) | Réduire I/O |
| Indexes déjà en repo (`20260424171124_…`) | Vérifier qu’ils existent en prod : `\di` / `pg_indexes` |
| Front : empty state HeroBanner | Évite skeleton éternel si 503 récurrent (amélioration UX, pas la cause) |

---

## 6. Livrables dans le repo

| Fichier | Rôle |
|---------|------|
| `supabase/migrations/MANUAL_incident_503_emergency_prod.sql` | SQL phases A→F |
| `docs/INCIDENT_SUPABASE_503_IMMEDIATE.md` | Ce runbook |

**Pas de migration auto** : fichier `MANUAL_*` à coller à la main en SQL Editor prod (comme les autres `MANUAL_*.sql`).

---

## 7. Checklist staging → production

Pour cet incident : **PROD uniquement** (`vpttoqojmiqxgudknyxf`).

- [ ] Phase A exécutée, résultats sauvegardés (screenshot)  
- [ ] Phase B si besoin  
- [ ] Phase C `active = false` sur tous les crons  
- [ ] Homepage 200 + contenu visible  
- [ ] Phase E réactivation sélective  
- [ ] E4 : aucune URL staging dans `cron.job.command`  
- [ ] Smoke auth + catalogue  

**Risque utilisateurs :** courte interruption des jobs background (expiration paniers, automation). Catalogue / auth doivent revenir dès que la DB respire.
