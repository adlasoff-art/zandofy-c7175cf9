# E2E Tests — Playwright

## Lancer en local (preview Lovable par défaut)

```bash
cd frontend
bun run test:e2e:install   # 1ère fois : télécharge Chromium
bun run test:e2e           # tous les specs
bun run test:e2e:ui        # mode interactif
```

## Cibler un autre environnement

```bash
# Local
PLAYWRIGHT_BASE_URL=http://localhost:8080 bun run test:e2e

# Staging Vercel
PLAYWRIGHT_BASE_URL=https://zandofy-staging.vercel.app bun run test:e2e

# Prod (read-only smoke uniquement !)
PLAYWRIGHT_BASE_URL=https://zandofy.com bun run test:e2e -- smoke
```

## Variables d'env optionnelles

- `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` — user de test pour les flows authentifiés.
  Sans ces variables, les specs concernés sont automatiquement skippés.

## Conventions

- 1 fichier `*.spec.ts` par feature majeure.
- Toujours guarder les actions destructives par un user de test dédié.
- Préférer les sélecteurs sémantiques (`getByRole`, `getByLabel`) aux CSS.
- Utiliser `test.skip()` plutôt que de laisser un test rouge si la fixture manque.

## Specs disponibles

| Fichier | Description | Auth requise |
|---|---|---|
| `smoke.spec.ts` | Charge la home, vérifie le titre | Non |
| `checkout-multi-origin.spec.ts` | Lot 11C — checkout panier multi-origines (CN+TR) | Oui |