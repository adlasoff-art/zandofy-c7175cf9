# Architecture — Zandofy

## System overview

| Part | Role |
|------|------|
| `frontend/` | React + Vite SPA (Lovable + Cursor), deployed on **Vercel** |
| `supabase/migrations/` | PostgreSQL schema (versioned SQL) |
| `supabase/functions/` | Edge Functions (Deno) — payments, email, sitemap, AI, etc. |
| `docs/` | Human and AI operating instructions |

Business logic lives in Supabase (SQL, RLS, triggers, Edge Functions). There is no separate application server in this repository.

## Environments

Two **Supabase projects** (staging + production) and **Vercel** for the frontend. See `docs/ENVIRONMENTS.md`.

## Delivery flow

```text
Lovable → GitHub → Vercel (frontend build)
                 → supabase/migrations/ (human: SQL Editor staging → prod)
                 → supabase/functions/ (deploy Supabase staging → prod)

Cursor → review, safe SQL, documentation, SEO/perf fixes
```

## CDN

Cloudflare: DNS, cache, WAF in front of Vercel and Supabase public endpoints.

## AI agents

- Instructions: `docs/LOVABLE_INSTRUCTIONS.md`
- Contract: `AGENTS.md`
- DB safety: `.cursor/rules/05-database-safety.mdc`

## Legacy paths (do not use)

- `frontend/supabase/` — consolidated to root `supabase/`
- Root `src/` — Lovable relic
- `docker-compose*.yml` — optional local experiments only; production frontend is Vercel

## Architectural rule

Feature work should not silently modify deployment, domains, ports, or variable naming.

## Rôles applicatifs (`app_role`)

Chaîne logistique canonique :

```text
vendor → forwarder → shipper → operator → rider → customer
```

| Rôle DB    | Libellé UI FR              | Espace dédié                  |
|------------|----------------------------|-------------------------------|
| admin      | Admin                      | `/admin/*`                    |
| manager    | Manager                    | `/admin/*`                    |
| vendor     | Vendeur                    | `/dashboard`, `/vendor`       |
| forwarder  | Transitaire                | `/forwarder/*`                |
| shipper    | Hub local                  | `/shipper-dashboard`          |
| operator   | Entreprise de livraison    | `/operator/*`                 |
| rider      | Livreur                    | `/rider-dashboard`, `/driver` |

- Source unique des libellés UI : `frontend/src/lib/role-labels.ts` (`ROLE_LABELS_FR`, `ROLE_LABELS_EN`, `ALL_APP_ROLES`).
- Clés i18n associées : `role.<rolename>` et `role.<rolename>.plural` dans `frontend/src/contexts/I18nContext.tsx`.
- Règles métier détaillées (qui livre, qui reçoit le cargo, garde-fous d'attribution) : voir `mem://auth/logistics-roles-canonical`.
- Plus jamais le libellé « Transporteur » seul — ambigu entre `shipper` et `forwarder`.
