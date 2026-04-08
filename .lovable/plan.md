

# Correction du workflow : remplacement ciblé

## Le problème
Ligne 27 : `secrets.STAGING_PROJECT_ID` → ce secret **n'existe pas** dans votre GitHub. Votre secret s'appelle `SUPABASE_PROJECT_ID`.

## La solution : remplacement complet du fichier

Je remplace le contenu entier car les deux steps (Staging + Production) doivent être mis à jour avec les vérifications défensives. Le fichier est court, un remplacement complet est plus propre qu'un patch partiel.

## Nouveau contenu

```yaml
name: Deploy Edge Functions (Multi-Env)

on:
  push:
    branches: [main, develop]
    paths:
      - 'frontend/supabase/functions/**'
      - 'frontend/supabase/config.toml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy to Staging
        if: github.ref == 'refs/heads/develop'
        run: |
          if [ -z "$PROJECT_REF" ]; then
            echo "::error::SUPABASE_PROJECT_ID secret is not set"
            exit 1
          fi
          supabase link --project-ref "$PROJECT_REF"
          supabase functions deploy --no-verify-jwt
        working-directory: frontend
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_ID }}

      - name: Deploy to Production
        if: github.ref == 'refs/heads/main'
        run: |
          if [ -z "$PROJECT_REF" ]; then
            echo "::error::PRODUCTION_PROJECT_ID secret is not set"
            exit 1
          fi
          supabase link --project-ref "$PROJECT_REF"
          supabase functions deploy --no-verify-jwt
        working-directory: frontend
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          PROJECT_REF: ${{ secrets.PRODUCTION_PROJECT_ID }}
```

## Ce qui change concrètement

| Avant | Après |
|---|---|
| `secrets.STAGING_PROJECT_ID` (inexistant) | `secrets.SUPABASE_PROJECT_ID` (votre vrai secret) |
| Crash silencieux si secret vide | Message d'erreur explicite + arrêt propre |
| Variable injectée directement dans la commande | Variable passée via `env:` puis référencée avec `"$PROJECT_REF"` (plus sûr) |

`PRODUCTION_PROJECT_ID` reste inchangé car il correspond déjà à votre secret GitHub.

## Fichier impacté
- `.github/workflows/deploy-edge-functions.yml` — remplacement complet

