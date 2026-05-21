---
name: WhatsApp/Facebook OG sharing pipeline
description: Comment fonctionne le partage produit (WhatsApp/FB) et procédure pour forcer un re-scrape quand l'aperçu reste périmé
type: feature
---

## Pipeline de partage social

1. Le bouton WhatsApp dans `ProductPage.tsx` partage l'URL `https://zandofy.com/product/:slug`.
2. WhatsApp envoie son crawler (`facebookexternalhit` / `whatsapp`) sur l'URL.
3. `vercel.json` détecte le User-Agent crawler et rewrite vers `/api/meta-injector`.
4. `frontend/api/meta-injector.ts` interroge Supabase prod (vpttoqojmiqxgudknyxf), récupère la première image du produit (table `product_images` triée par `position`) et injecte les balises OG/Twitter dans le HTML.
5. WhatsApp lit `og:image` et affiche l'aperçu.

## Caches qui peuvent bloquer un changement d'image

- **Vercel Edge** : 60 s pour `/product/*`, `/store/*`, `/category/*`, `/blog/*` (court — propagation rapide). 10 min pour pages globales.
- **Meta/WhatsApp** : ~7 jours côté serveur Facebook. Un re-scrape via Debugger purge ce cache pour TOUS les utilisateurs.
- **Cache in-memory edge fn** : 60 s pour `seo_config`, purgeable via header `x-purge-cache: 1`.

## Procédure de re-scrape (admin)

Aller dans **Admin → SEO → Aperçus réseaux sociaux & re-scrape** :
1. Saisir le path (ex `/product/mon-slug`).
2. Cliquer **« Purger le cache Vercel »**.
3. Cliquer **« Facebook & WhatsApp »** → ouvre le Debugger Meta.
4. Sur le Debugger, cliquer **« Récupérer à nouveau »** 1-2 fois.
5. Le prochain partage WhatsApp affichera la nouvelle image.

## Architecture clé

- `frontend/api/meta-injector.ts` : Vercel Edge Function (source unique de vérité OG dynamique).
- `supabase/functions/share-proxy/index.ts` : existe mais NON utilisé. À supprimer dans un cleanup futur.
- `frontend/src/components/admin/seo/SeoSocialRescrapeSection.tsx` : UI admin pour forcer le re-scrape.
