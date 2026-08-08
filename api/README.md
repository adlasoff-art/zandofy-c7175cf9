# Vercel Edge `/api` (repo root)

**Pourquoi ici :** le projet Vercel a Root Directory = **racine du repo**
(`vite.config.ts` → `root: "frontend"`, `outDir: "../dist"`).

Vercel ne déploie les Edge Functions que depuis `/api` à la racine du projet.
`frontend/api/` est la **source d’édition** ; `npm run build` synchronise vers `/api`
via `frontend/scripts/sync-vercel-api.mjs`.

Ne pas supprimer ce dossier. Après edit de `frontend/api/*`, rebuild ou relancer le sync.
