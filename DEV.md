# Développement — Zandofy

Le backend applicatif est **Supabase** (PostgreSQL, RLS, triggers, Edge Functions). Il n’y a pas de serveur API Python séparé dans ce dépôt.

## Références

- **Frontend local** : `frontend/README.md` (si présent) ou `README.md`
- **Stack** : `docs/ARCHITECTURE-STACK.md`
- **Environnements** : `docs/ENVIRONMENTS.md`
- **Agents / workflow** : `AGENTS.md`, `docs/AI-WORKFLOW.md`

## SQL et Edge Functions

- Migrations : `supabase/migrations/`
- Functions : `supabase/functions/`
- Procédure : staging (SQL Editor) → tests → production
