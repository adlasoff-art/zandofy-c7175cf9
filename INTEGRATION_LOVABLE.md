# Intégration Lovable ↔ Zandofy

## Stack actuelle

| Composant | Emplacement |
|-----------|-------------|
| Frontend React/Vite | `frontend/` → **Vercel** |
| Auth + DB + API | **Supabase** (projet staging + projet production) |
| Edge Functions | `supabase/functions/` |
| Migrations SQL | `supabase/migrations/` |

## Instructions pour Lovable

Voir **`docs/LOVABLE_INSTRUCTIONS.md`** (prompt à copier-coller).

## Workflow humain

1. Lovable pousse sur GitHub.
2. Vercel rebuild le frontend.
3. SQL : exécution manuelle staging → production (SQL Editor Supabase).
4. Edge Functions : deploy Supabase staging → production.

## Référence complète agents

- `AGENTS.md`
- `docs/AI-WORKFLOW.md`
- `supabase/README.md` (si présent)
