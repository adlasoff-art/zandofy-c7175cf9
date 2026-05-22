# SEO bots — stratégie actuelle (lot G3)

## Décision retenue

**Pas de migration SSR complète pour l’instant.** On conserve la SPA Vite + **injection HTML pour les crawlers** déjà en place.

| Couche | Rôle |
|--------|------|
| **Humains** | SPA React (`index.html` → bundle JS) |
| **Bots** (Google, Bing, réseaux sociaux, etc.) | Rewrite Vercel → [`frontend/api/meta-injector.ts`](../frontend/api/meta-injector.ts) (Edge) |
| **Sitemap** | Edge Function [`supabase/functions/generate-sitemap`](../supabase/functions/generate-sitemap/index.ts) via `/sitemap.xml` |

Routes bot avec meta + JSON-LD injectés (voir [`frontend/vercel.json`](../frontend/vercel.json)) :

- `/product/:slug`
- `/store/:slug`
- `/category/:slug`
- `/blog/:slug`
- Pages statiques listées (`faq`, `stores`, `blog`, …)

## Pourquoi ne pas SSR tout de suite

- ~4 000 utilisateurs en prod — risque de régression deploy / routing Vercel.
- `meta-injector` couvre déjà l’indexation des URLs catalogue pour les bots.
- Prochaine étape si besoin : **prerender service** (ex. Prerender.io) ou **Vercel ISR** sur un sous-ensemble de routes, après mesure Search Console.

## Actions lot G3 réalisées dans le code

- Sitemap catégories aligné sur `slugify()` (comme `CategoryPage`).
- JSON-LD `ItemList` sur pages catégorie.
- Meta `keywords` branchées depuis la config admin SEO.
- FAQ schema (`FAQPage`) sur fiche produit (AEO).

## Vérification

1. Tester avec [Google Rich Results Test](https://search.google.com/test/rich-results) sur une URL produit publique.
2. `curl -A "Googlebot" https://www.zandofy.com/product/<slug>` → HTML avec `<title>` et `application/ld+json` dans le `<head>`.

## Canonical / www

Utiliser **`VITE_SITE_URL`** sur Vercel (prod) comme source unique. `SEOHead` et le sitemap utilisent la même base. Éviter de mélanger `zandofy.com` et `www.zandofy.com` sans redirection 301 côté DNS/Vercel.
