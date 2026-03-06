# AI Workflow

## Goal

This document defines how work moves safely from idea to staging to production in Zandofy.

## Standard Delivery Flow

1. A feature is defined in plain language with scope and expected outcome.
2. A branch is created: `feature/<short-name>`.
3. Lovable generates the scoped implementation.
4. Code is pushed to GitHub.
5. Cursor AI reviews, integrates, and stabilizes the result.
6. Missing backend, DB, env, Docker, or deployment work is identified and handled.
7. The feature is merged into `develop`.
8. Coolify staging deploys `develop`.
9. Human validation happens on staging.
10. Once validated, `develop` is merged into `main`.
11. Coolify production deploys `main`.

## What a Lovable Request Must Include

Each request to Lovable should specify:

- feature goal
- target area (`frontend`, `backend`, `db`, or mixed)
- files or folders Lovable may edit
- files Lovable must not edit
- whether DB changes are allowed
- whether env changes are allowed
- expected output (UI only, migration, API wiring, copy, etc.)

## What Cursor AI Must Check

Before merge to `develop`:

- frontend build impact
- backend/API impact
- environment variable changes
- Supabase migration impact
- Docker/Coolify impact
- staging readiness

Before merge to `main`:

- staging validation completed
- no unresolved infrastructure drift
- no undocumented variable changes
- migrations applied or rollout documented

## Coordination Rules

- Lovable generates scoped code.
- Cursor AI integrates and hardens the result.
- GitHub stores the truth.
- Coolify deploys from GitHub only.
- Humans approve staging and production transitions.

## Definition of Done

A feature is not done until:

- code is committed
- env changes are documented
- migration needs are identified
- staging deployment is understood
- rollback risk is known
