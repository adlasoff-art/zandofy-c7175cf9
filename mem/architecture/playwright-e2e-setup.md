---
name: Playwright E2E Setup
description: Tests E2E Playwright — config, structure, et CI workflow. Cibler preview Lovable par défaut, override via PLAYWRIGHT_BASE_URL. Sandbox Lovable ne peut PAS exécuter Chromium (libs manquantes), donc tests tournent uniquement en CI GitHub Actions ou local dev.
type: feature
---

# Playwright E2E

## Stack
- `@playwright/test` v1.59+
- Config : `frontend/playwright.config.ts`
- Specs : `frontend/e2e/*.spec.ts` (séparé de Vitest qui cible `src/**`)
- CI : `.github/workflows/e2e-playwright.yml` — **build + vite preview local** (ne plus cibler l’URL preview Lovable protégée par login)
- Build CI : secrets GitHub `VITE_*` **ou** fallback `frontend/.env.e2e` (clé anon publique prod, déjà dans `api/meta-injector.ts`)

## Commandes
```bash
cd frontend
bun run test:e2e:install   # 1ère fois
bun run test:e2e           # tous specs
bun run test:e2e:ui        # mode UI
PLAYWRIGHT_BASE_URL=http://localhost:8080 bun run test:e2e
```

## Conventions
- `getByRole`/`getByLabel` plutôt que CSS.
- `test.skip()` quand fixture manque (jamais de test rouge "en attente").
- Variables `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` pour flows authentifiés.
- Specs auth-required doivent avoir `test.skip(!process.env.E2E_USER_EMAIL, ...)` au top.

## Limitations
- **Le sandbox Lovable ne peut PAS exécuter Chromium** (libglib manquante, pas d'apt-get). Les tests tournent uniquement :
  1. En GitHub Actions (workflow `e2e-playwright.yml`)
  2. En local dev (poste développeur avec Chromium installé)
- Donc : pas de validation E2E depuis Lovable, prévoir tests Vitest pour la logique pure.

## Specs actuels
- `smoke.spec.ts` — Charge home, vérifie titre Zandofy.
- `checkout-multi-origin.spec.ts` — Lot 11C, panier multi-origines (skip si pas d'user de test).
