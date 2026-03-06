# Architecture

## System Overview

Zandofy currently operates as a multi-part platform:

- `frontend/` = React + Vite application, initially generated from Lovable, then integrated in GitHub
- `backend/` = FastAPI API and business logic
- `frontend/supabase/` = Supabase migrations and Edge Functions
- `docker-compose.yaml` = deployment entry point currently used by Coolify

## Delivery Architecture

```text
Lovable
  -> scoped code generation
  -> GitHub feature branch

Cursor AI
  -> code review and integration
  -> backend / DB / env / deploy alignment

GitHub
  -> single source of truth

Coolify Staging
  -> deploys develop

Coolify Production
  -> deploys main
```

## Runtime Architecture

```text
Frontend (Vite build -> Nginx container)
  -> calls FastAPI backend
  -> calls Supabase public APIs

Backend (FastAPI)
  -> uses PostgreSQL / Supabase data
  -> handles business logic, auth, email, payment, media workflows

Supabase
  -> database schema and public API
  -> auth / storage / functions depending on feature area
```

## Sensitive Files

The following files are infrastructure-sensitive and must be edited carefully:

- `docker-compose.yaml`
- `docker-compose.prod.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`

## Architectural Rule

Feature work should not silently modify deployment, domains, ports, or variable naming. Those changes must be deliberate, documented, and reviewed.
