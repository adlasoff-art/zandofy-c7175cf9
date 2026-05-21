# Environments — Zandofy

## Overview

| Environment | Frontend | Database / Auth / API |
|-------------|----------|------------------------|
| **Staging** | Vercel (branch `develop` or preview — configure per project) | Supabase project **staging** |
| **Production** | Vercel (`main` → `https://www.zandofy.com`) | Supabase project **production** |

Cloudflare sits in front of DNS/cache/WAF for `zandofy.com`.

**Deprecated hostnames (do not use):** `studio-staging.zandofy.com`, `api.zandofy.com`, `api-staging.zandofy.com`, `supabasa.*`

## Staging

Purpose:

- integration testing
- SQL migration validation before production
- feature validation

Configure in **Vercel** (preview or staging project):

- `VITE_SUPABASE_URL` = Supabase staging project URL (`https://<ref>.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` = staging anon key
- `VITE_SUPABASE_PROJECT_ID` = staging project ref
- `VITE_SITE_URL` = staging frontend URL (preview URL or dedicated domain)

SQL: run new files from `supabase/migrations/` in **staging** SQL Editor first.

## Production

Purpose:

- live traffic (~4000+ users)
- real orders and vendor data

Configure in **Vercel** production:

- `VITE_SUPABASE_URL` = Supabase **production** project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = production anon key
- `VITE_SUPABASE_PROJECT_ID` = production project ref
- `VITE_SITE_URL` = `https://www.zandofy.com` (or canonical domain)

SQL: same migration file as staging, after validation.

## Variable ownership

### Frontend (Vercel build — `VITE_*` only)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SITE_URL`

### Supabase secrets (Dashboard / Edge Functions only — never in frontend)

- `SUPABASE_SERVICE_ROLE_KEY`
- KelPay / SMTP / AI API keys
- Webhook secrets

## Rules

- Never commit `.env` with real keys.
- Never put service role keys in frontend or `VITE_*`.
- Staging and production Supabase projects stay isolated.
- Document new `VITE_*` names in `frontend/.env.example` before use.

## Git branches (target)

| Branch | Typical target |
|--------|----------------|
| `develop` | Vercel staging + Supabase staging |
| `main` | Vercel production + Supabase production |

Operational note: if Lovable pushes to `main` directly, ensure Vercel production env vars still point to **production** Supabase only.
