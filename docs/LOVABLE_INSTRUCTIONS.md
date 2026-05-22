# Instructions pour Lovable — Zandofy

Copier-coller ce bloc au début de chaque demande Lovable.

---

## Prompt de base

```
Tu travailles sur Zandofy, marketplace e-commerce multi-vendeurs (Afrique / sourcing international).

Stack actuelle (ne pas proposer d'autre backend) :
- Frontend : React + TypeScript + Vite dans le dossier frontend/
- Déploiement frontend : Vercel → https://www.zandofy.com
- Backend : Supabase Pro (Auth, PostgreSQL, Storage, Realtime, Edge Functions Deno)
- CDN : Cloudflare (cache / DNS) — pas de R2 pour l'instant

Dépôt GitHub = source de vérité.

Chemins autorisés :
- frontend/src/** (pages, components, hooks, services)
- supabase/migrations/*.sql — UNIQUEMENT si je demande explicitement un changement DB
- supabase/functions/** — UNIQUEMENT si je demande explicitement une Edge Function

Chemins interdits :
- frontend/vercel.json, index.html meta/CSP (sauf demande explicite)
- AGENTS.md, .cursor/rules/, docs/ (sauf demande explicite)
- Renommer ou inventer des variables VITE_*
- frontend/supabase/ (n'existe plus — utiliser supabase/ à la racine du repo)

Variables d'environnement (ne pas modifier les noms) :
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_PROJECT_ID
- VITE_SITE_URL

Environnements Supabase :
- Projet STAGING (tests SQL et fonctions d'abord)
- Projet PRODUCTION (utilisateurs réels — prudence maximale)

Workflow attendu :
1. Tu génères le code frontend (et SQL/functions si demandé).
2. Push GitHub (souvent main ; idéalement develop quand disponible).
3. Vercel rebuild le frontend.
4. Les migrations SQL sont exécutées manuellement par l'humain : STAGING puis PRODUCTION (SQL Editor).

Règles SQL si je te demande une migration :
- Fichier dans supabase/migrations/ avec timestamp + nom descriptif
- Changements additifs de préférence (ADD COLUMN, nouvelles tables)
- RLS activé sur toute nouvelle table
- Pas de DROP TABLE / DROP COLUMN sans instruction explicite
- Indiquer checklist : staging → tests → production

Si ta feature nécessite DB, Edge Function ou nouvelle variable d'env :
- Indique-le clairement en fin de réponse
- Ne modifie pas silencieusement l'infra
```

---

## Scope autorisé

- UI, composants, pages, hooks React
- Migrations SQL et Edge Functions **sur demande explicite**
- Indiquer les impacts staging/production

## Scope interdit

- Créer un backend Python/API séparé hors Supabase
- Fichiers de déploiement et variables d'env sans accord
- Migrations destructives non demandées

## Workflow

```text
Lovable → GitHub → Vercel (frontend)
                 → supabase/migrations/ (revue humaine → SQL Editor staging → prod)
                 → supabase/functions/ (deploy Supabase staging → prod)
```

Cursor AI revoit le code dans le même dépôt avant validation production.
