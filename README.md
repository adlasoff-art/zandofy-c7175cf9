# Zandofy

Plateforme e‑commerce — frontend React/Vite (Lovable) + Supabase (Auth, PostgreSQL, Edge Functions).

## Structure

- **frontend/** — Application React + Vite (`npm run dev` / build Vercel)
- **supabase/migrations/** — Migrations SQL (source de vérité)
- **supabase/functions/** — Edge Functions Deno
- **docs/** — Instructions humains et agents IA

## Démarrage rapide (local)

```bash
cd frontend
npm install
cp .env.example .env   # puis éditer avec le projet Supabase (staging)
npm run dev
```

Variables : voir `frontend/.env.example` et `docs/ENVIRONMENTS.md`.

## Documentation

| Fichier | Description |
|--------|-------------|
| **AGENTS.md** | Accord de travail (branches, limites, sécurité) |
| **docs/AI-WORKFLOW.md** | Workflow Lovable → GitHub → Vercel → Supabase |
| **docs/ENVIRONMENTS.md** | Staging / production, variables `VITE_*` |
| **docs/ARCHITECTURE.md** | Architecture applicative |
| **docs/ARCHITECTURE-STACK.md** | Détail stack technique |
| **docs/LOVABLE_INSTRUCTIONS.md** | Prompt à donner à Lovable |
| **PRODUCTION-READINESS.md** | Checklist avant mise en production |
| **INTEGRATION_LOVABLE.md** | Intégration frontend ↔ Supabase |

## Livraison

| Branche | Cible typique |
|--------|----------------|
| `develop` | Vercel preview/staging + Supabase staging |
| `main` | Vercel production (`https://www.zandofy.com`) + Supabase production |

Lovable génère le code, GitHub est la source de vérité, Cursor revoit et stabilise, l’humain valide les migrations SQL en staging puis production.
