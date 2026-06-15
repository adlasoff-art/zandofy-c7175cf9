---
description: Project-wide operating agreement for humans and AI agents
---

# Zandofy Working Agreement

## Mission

Zandofy is developed through a controlled workflow:

- **Lovable** generates scoped product code (frontend, optional SQL, optional Edge Functions).
- **GitHub** is the single source of truth.
- **Cursor AI** reviews, integrates, and stabilizes before production impact.
- **Human validation** is required before production database changes.

## Stack (current — do not suggest alternatives unless asked)

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite → **Vercel** (`https://www.zandofy.com`) |
| Backend | **Supabase Pro** (Auth, PostgreSQL, Storage, Realtime, Edge Functions) |
| CDN | **Cloudflare** (DNS, cache, WAF) — R2 not in use yet |
| PWA | Service worker (`frontend/public/sw.js`) |

## Supabase environments

Two separate Supabase projects (staging + production). Each has its own database, keys, and Edge Function deployments.

- **Staging** — test schema changes and features first.
- **Production** — live users (~4000+ accounts); treat with extreme care.

Frontend `VITE_*` variables point to the Supabase project for that Vercel environment.

## Git branches

| Branch | Intended use |
|--------|----------------|
| `main` | Production frontend (Vercel production) |
| `develop` | Staging / integration (when branch protection allows) |
| `RemStaging` | Optional staging alias |
| `feature/*` | One feature at a time |

**Current operational note:** Lovable may push to `main` when branch rules block other branches. Prefer restoring `develop` + protected `main` when possible.

## Deployment workflow

### Frontend (Vercel)

1. Code merged to the branch connected to the target Vercel project.
2. Vercel builds `frontend/` (`npm run build` → `dist/`).
3. No backend secrets on Vercel — only `VITE_*` public keys.

### Database (manual SQL — critical)

1. Every schema change = one new file in **`supabase/migrations/`** (repository root).
2. Human runs the SQL in **Supabase SQL Editor → staging project** first.
3. Validate (smoke tests: auth, product list, checkout, vendor dashboard).
4. Run the **same file** in **production** SQL Editor.
5. Never apply production-only SQL that is not committed in GitHub.

### Edge Functions

- Source of truth: **`supabase/functions/`** (repository root).
- Deploy to staging Supabase, test, then deploy to production.

## Repository layout

```
frontend/          # React app (Vercel root)
supabase/
  migrations/      # ONLY place for SQL migrations
  functions/       # ONLY place for Edge Functions
docs/              # Human + AI instructions
.cursor/rules/     # Cursor agent rules
```

**Do not use:** `frontend/supabase/` (removed — legacy), root `src/` (removed — legacy Lovable).

## AI roles

### Lovable may work on

- `frontend/src/**` (UI, pages, components, hooks)
- New files in `supabase/migrations/` when explicitly asked for DB changes
- New or updated files in `supabase/functions/` when explicitly asked

### Lovable must not change without explicit human approval

- `frontend/vercel.json`, deployment ports, domains
- `VITE_*` variable names
- `AGENTS.md`, `.cursor/rules/`, `docs/LOVABLE_INSTRUCTIONS.md`
- Destructive SQL (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`)
- Mixing staging and production credentials

### Cursor AI responsibilities

- Review Lovable output before trusting production
- Flag DB, RLS, Edge Function, and env impacts
- Deliver migration SQL safe for staging → production
- Keep documentation aligned with this file

## Database rules

- Schema changes = committed migration in `supabase/migrations/`.
- Prefer additive changes (`ADD COLUMN`, new tables, new policies).
- Enable RLS on every new table.
- Do not rely on undocumented manual prod edits.
- See `.cursor/rules/05-database-safety.mdc` for full safety protocol.

## Environment rules

- Public frontend variables: `VITE_*` prefix only.
- Never put service role keys or secrets in frontend code.
- Document new variables in `.env.example`.
- Do not rename existing `VITE_*` without explicit approval.

## Safety rules

- Treat Lovable output as draft until reviewed.
- Do not silently change domains, ports, or URLs.
- Do not break existing tables or delete user data.
- Staging and production Supabase projects must stay isolated.

**Current stack only:** Vercel (frontend) + Supabase Pro (staging + production projects) + Cloudflare (DNS/CDN).
