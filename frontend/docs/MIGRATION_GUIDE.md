# Guide de migration — archivé

Ce document historique (VPS self-hosted, ancienne API) **n’est plus utilisé**.

## Stack actuelle

- **Frontend** : Vercel (`https://www.zandofy.com`)
- **Backend** : Supabase Pro (projets staging + production)
- **Migrations SQL** : `supabase/migrations/` → SQL Editor Supabase (staging puis production)
- **Edge Functions** : `supabase/functions/` → deploy Supabase CLI ou Dashboard

## Références à jour

| Sujet | Fichier |
|--------|---------|
| Environnements et variables | `docs/ENVIRONMENTS.md` |
| Workflow agents | `AGENTS.md`, `docs/AI-WORKFLOW.md` |
| Instructions Lovable | `docs/LOVABLE_INSTRUCTIONS.md` |
| Architecture | `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-STACK.md` |
| Production | `PRODUCTION-READINESS.md` |

L’ancien contenu détaillé de ce guide a été retiré pour éviter toute confusion avec l’infra actuelle.
