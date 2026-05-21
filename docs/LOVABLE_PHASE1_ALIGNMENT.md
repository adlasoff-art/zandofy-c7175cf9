# Alignement Lovable — Zandofy

> Ce document remplace l’ancienne version (Coolify / FastAPI / `frontend/supabase/`).

## Document principal

Utilisez **`docs/LOVABLE_INSTRUCTIONS.md`** — prompt complet à donner à Lovable pour chaque feature.

## Structure du dépôt

```
frontend/src/     → UI React (Lovable)
supabase/
  migrations/     → SQL (sur demande explicite)
  functions/      → Edge Functions (sur demande explicite)
```

## Déploiement

- **Frontend** : GitHub → Vercel (`www.zandofy.com`)
- **Base de données** : fichier SQL dans `supabase/migrations/` → SQL Editor **staging** → tests → **production**
- **Pas de** Coolify, FastAPI, `api.zandofy.com`, `supabasa.*`

## Rôle Cursor

Revue du code Lovable, migrations sûres, documentation à jour (`AGENTS.md`, rules `.cursor/rules/`).
