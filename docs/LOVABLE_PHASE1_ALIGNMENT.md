# Alignement Lovable — Zandofy

> Alignement Lovable sur le monorepo actuel (Vercel + Supabase).

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
## Rôle Cursor

Revue du code Lovable, migrations sûres, documentation à jour (`AGENTS.md`, rules `.cursor/rules/`).
