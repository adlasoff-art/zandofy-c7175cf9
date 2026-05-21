# Architecture — Zandofy

## System overview

| Part | Role |
|------|------|
| `frontend/` | React + Vite SPA (Lovable + Cursor), deployed on **Vercel** |
| `supabase/migrations/` | PostgreSQL schema (versioned SQL) |
| `supabase/functions/` | Edge Functions (Deno) — payments, email, sitemap, AI, etc. |
| `docs/` | Human and AI operating instructions |

There is **no** FastAPI `backend/` in the active stack. Business logic lives in Supabase (SQL, RLS, triggers, Edge Functions).

## Environments

Two **Supabase projects** (staging + production) and **Vercel** for the frontend. See `docs/ENVIRONMENTS.md`.

## Delivery flow

```text
Lovable → GitHub → Vercel (frontend build)
                 → supabase/migrations/ (human: SQL Editor staging → prod)
                 → supabase/functions/ (deploy Supabase staging → prod)

Cursor → review, safe SQL, documentation, SEO/perf fixes
```

## CDN

Cloudflare: DNS, cache, WAF in front of Vercel and Supabase public endpoints.

## AI agents

- Instructions: `docs/LOVABLE_INSTRUCTIONS.md`
- Contract: `AGENTS.md`
- DB safety: `.cursor/rules/05-database-safety.mdc`

## Deprecated (removed from active architecture)

- Coolify, docker-compose deploy path
- `api.zandofy.com`, `supabasa.*`, `studio-staging.zandofy.com`
- `frontend/supabase/` (consolidated to root `supabase/`)
- Root `src/` Lovable relic
