# SEO bots — stratégie actuelle (marketplace)

## Architecture

| Couche | Rôle |
|--------|------|
| **Humains** | SPA React (`index.html` → bundle JS) + `SEOHead` |
| **Bots** | Rewrite Vercel UA → [`frontend/api/meta-injector.ts`](../frontend/api/meta-injector.ts) |
| **Sitemap** | Edge Function [`supabase/functions/generate-sitemap`](../supabase/functions/generate-sitemap/index.ts) via `/sitemap.xml` |
| **CMS** | Admin → `/admin/seo` (global, pages, catégories, templates, sitelinks, couverture) |

Canonical host : **`https://www.zandofy.com`** (`VITE_SITE_URL` / `SITE_URL`).

## Routes bot (meta-injector)

- `/` (accueil — `seo_config` + override + JSON-LD Organization / WebSite / SiteNavigation)
- `/product/:slug`, `/store/:slug`, `/category/:slug`, `/blog/:slug`
- Hubs : `faq`, `stores`, `blog`, `about`, `careers`, `help-center`, `pricing`, `privacy`, `terms`, `popular`, `trends`, `search`, `become-vendor`, `affiliate-program`, `loyalty-program`, `social-responsibility`
- Privés (souvent noindex via override) : `auth`, `reset-password`, `onboarding`, `impersonate`

`/help` → **301** `/help-center`. `/contact` → **301** `/faq`.

## Métas entités

| Entité | Source priorité |
|--------|-----------------|
| Accueil / pages | `seo_page_overrides` → `seo_config` |
| Catégorie | `categories.meta_*` → templates `category_*_template` |
| Produit | `products.meta_*` → templates `product_*_template` |
| Boutique | `stores.meta_*` → templates `store_*_template` |
| Blog | `blog_posts.meta_*` |

`jsonld_extra` sur overrides est **fusionné** dans le JSON-LD injecté.

## Vérification

```bash
curl -A "Googlebot" -sL "https://www.zandofy.com/" | head -n 80
curl -A "Googlebot" -sL "https://www.zandofy.com/category/fashion" | grep -E "<title>|description"
```

1. [Rich Results Test](https://search.google.com/test/rich-results)
2. Search Console : soumettre `https://www.zandofy.com/sitemap.xml`
3. Après change SEO admin : purge cache via header `x-purge-cache: 1` sur `/api/meta-injector` (déjà déclenchée à la sauvegarde)

## Hors scope (volontaire)

- SSR React complet
- Score focus keyword type Rank Math
- Redirect manager / 404 monitor (phase ultérieure)

Voir [`SEO_MARKETPLACE_PLAYBOOK.md`](./SEO_MARKETPLACE_PLAYBOOK.md) pour ops GSC / GBP.
