
# Plan : Forcer zandofy.com dans le sitemap dynamique

## Problème
L'Edge Function `generate-sitemap` lit `SITE_BASE_URL` depuis les variables d'environnement. Dans Lovable Cloud, cette variable vaut `https://...lovable.app`, ce qui écrase le fallback `https://zandofy.com`.

## Solution
Hardcoder `https://zandofy.com` directement dans l'Edge Function au lieu de dépendre de `SITE_BASE_URL`. C'est la bonne approche car le sitemap est destiné à Google/SEO et doit toujours pointer vers le domaine de production.

## Fichier modifié

| Fichier | Changement |
|---------|-----------|
| `frontend/supabase/functions/generate-sitemap/index.ts` | Ligne 3 : remplacer `Deno.env.get("SITE_BASE_URL") \|\| "https://zandofy.com"` par `"https://zandofy.com"` directement |

## Vérification
- Le sitemap statique `frontend/public/sitemap.xml` utilise déjà `zandofy.com` ✓
- Après déploiement, tester via `curl` sur l'Edge Function pour confirmer que tous les liens pointent vers `zandofy.com`
