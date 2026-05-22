# Zandofy — AI Workflow

## Stack

| Component | Service |
|-----------|---------|
| Frontend | React/Vite → **Vercel** (`www.zandofy.com`) |
| Backend | **Supabase Pro** (2 projects: staging + production) |
| CDN | **Cloudflare** |
| Code source | **GitHub** |

## Agents

| Agent | Role |
|-------|------|
| **Lovable** | Generate frontend (and SQL/functions when asked) |
| **Cursor** | Review, integrate, safe migrations, documentation |
| **Human** | Run SQL in Supabase SQL Editor, approve production |

## Pipeline

1. Scoped request to Lovable (use `docs/LOVABLE_INSTRUCTIONS.md` prompt).
2. Lovable pushes to GitHub (`main` or `develop`).
3. Cursor reviews diff (security, RLS, SEO, perf).
4. Vercel deploys frontend from connected branch.
5. New migration file in `supabase/migrations/` → human runs on **staging** → tests → **production**.
6. Edge Functions in `supabase/functions/` → deploy staging → production.

## Legacy paths

- `frontend/supabase/` — use root `supabase/` only

## Cursor rules

See `.cursor/rules/` especially:

- `01-project-workflow.mdc`
- `05-database-safety.mdc`

## Database safety summary

- Single migration path: `supabase/migrations/`
- Staging before production, always
- Additive migrations by default
- ~4000+ live users — no destructive schema without explicit approval
