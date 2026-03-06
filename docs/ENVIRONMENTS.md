# Environments

## Purpose

This document defines the current and target environment model for Zandofy.

## Staging

Purpose:
- integration testing
- feature validation
- deployment rehearsal

Current public endpoints:
- frontend: `https://studio.zandofy.com`
- backend: `https://api.zandofy.com`
- supabase: `https://supabasa.zandofy.com`

Expected core values:
- `SITE_BASE_URL=https://studio.zandofy.com`
- `VITE_API_URL=https://api.zandofy.com`
- `VITE_SUPABASE_URL=https://supabasa.zandofy.com`

## Production

Purpose:
- stable public release
- validated customer traffic

Target public endpoints:
- frontend: `https://zandofy.com`
- backend: production API domain
- supabase: production Supabase endpoint

Expected core values:
- `SITE_BASE_URL=https://zandofy.com`
- `VITE_API_URL=<production-api-url>`
- `VITE_SUPABASE_URL=<production-supabase-url>`

## Variable Ownership

### Frontend public build-time variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_API_URL`

### Backend variables

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `CORS_ORIGINS`
- `SITE_BASE_URL`
- `SUPABASE_JWT_SECRET`
- SMTP variables
- payment variables
- VAPID variables

## Rules

- Frontend variables must never contain backend secrets.
- Staging and production values must stay separate.
- Any new variable must be added to the relevant `.env.example`.
- Coolify values must match the branch-to-environment mapping.
