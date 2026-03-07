# Environments

## Purpose

This document defines the staging and production environment model for Zandofy. Staging uses the `-staging` suffix on subdomains. Production uses the main subdomains.

## Staging (suffix `-staging`)

Purpose:
- integration testing
- feature validation
- deployment rehearsal
- base de données dédiée (données de test, pas de mélange avec prod)

Public endpoints:
- frontend: `https://studio-staging.zandofy.com`
- backend: `https://api-staging.zandofy.com`
- supabase: `https://supabasa-staging.zandofy.com`

Expected core values (Coolify staging):
- `SITE_BASE_URL=https://studio-staging.zandofy.com`
- `VITE_API_URL=https://api-staging.zandofy.com`
- `VITE_SUPABASE_URL=https://supabasa-staging.zandofy.com`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = clé anon du projet Supabase staging
- `DATABASE_URL` = connexion vers la base Supabase staging

## Production

Purpose:
- stable public release
- validated customer traffic
- base de données dédiée (données réelles)

Public endpoints:
- frontend: `https://zandofy.com`
- backend: `https://api.zandofy.com`
- supabase: `https://supabasa.zandofy.com`

Expected core values (Coolify production):
- `SITE_BASE_URL=https://zandofy.com`
- `VITE_API_URL=https://api.zandofy.com`
- `VITE_SUPABASE_URL=https://supabasa.zandofy.com`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = clé anon du projet Supabase production
- `DATABASE_URL` = connexion vers la base Supabase production

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
