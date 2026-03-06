---
description: Project-wide operating agreement for humans and AI agents
---

# Zandofy Working Agreement

## Mission

Zandofy is developed through a controlled workflow:
- Lovable generates scoped product code.
- GitHub is the single source of truth.
- Cursor AI reviews, integrates, and stabilizes.
- Coolify deploys staging and production from GitHub.
- Human validation is required before production release.

## Branching Strategy

- `main` = production-ready branch
- `develop` = staging branch
- `feature/*` = one feature at a time
- `hotfix/*` = urgent production fixes

## Deployment Strategy

- `develop` deploys to staging.
- `main` deploys to production.
- No manual production-only change is considered complete until it is reflected back in GitHub.

## AI Roles

### Lovable may work on

- frontend UI and pages
- React components and hooks
- TypeScript client logic
- isolated feature work
- explicit Supabase Edge Functions when requested
- explicit Supabase migrations when requested

### Lovable must not change without explicit approval

- `docker-compose.yaml`
- `docker-compose.prod.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- deployment ports
- domains and routing
- environment variable names
- infrastructure architecture
- Git workflow
- AI rules files
- `AGENTS.md`

### Cursor AI responsibilities

- review generated code before integration
- identify backend, DB, env, Docker, and deployment implications
- stabilize changes before merge to `develop` or `main`
- document missing migrations, variables, or rollout steps

## Database Rules

- Schema changes must be represented by committed migrations.
- Do not rely on undocumented manual DB edits.
- `frontend/supabase/migrations/` is the source of truth for Supabase schema changes.

## Environment Rules

- Frontend public build-time variables use the `VITE_*` prefix.
- Backend secrets must never appear in frontend files.
- Any new environment variable must be documented in `.env.example` and project docs.
- Renaming existing environment variables requires explicit approval.

## Current Environment Model

### Staging

- frontend: `https://studio.zandofy.com`
- backend: `https://api.zandofy.com`
- supabase: `https://supabasa.zandofy.com`

### Production target

- frontend: `https://zandofy.com`
- backend: production API domain
- production services should remain isolated from staging where possible

## Safety Rules

- Do not casually edit deployment-sensitive files.
- Do not silently change domains, ports, or URLs.
- Do not mix staging and production variables.
- Treat Lovable output as draft code until reviewed and integrated.
