# Vercel Edge Function: meta-injector

Cette fonction n'est invoquée **que pour les bots** (Googlebot, Bingbot, Facebook, Twitter, LinkedIn, WhatsApp, etc.) sur les routes publiques dynamiques :

- `/product/:slug`
- `/store/:slug`
- `/category/:slug`
- `/blog/:slug`
- pages globales (`/faq`, `/stores`, …)

## Pourquoi

Zandofy est une SPA React → le HTML statique servi par Vercel est identique pour toutes les pages. Sans injection, Meta/WhatsApp lisent `index.html` (og:url = home, og:image = `og-default.jpg`).

## Ce que fait la fonction

1. Le rewrite Vercel envoie le bot vers `/api/meta-injector?__pathname=/product/:slug` (voir `vercel.json`).
2. `resolveRequestPathname` restaure le chemin public (query `__pathname`, en-têtes Vercel, ou pathname).
3. Fetch Supabase REST (variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`) pour métadonnées produit / boutique / etc.
4. Strip les balises SEO statiques du `<head>`.
5. Injecte `canonical`, `og:url`, `og:image` (photo produit en HTTPS absolu), Twitter, JSON-LD, optionnel `fb:app_id`.
6. Si produit introuvable : fallback avec `og:url` = URL demandée (jamais la home) et `noindex`.

## Variables Vercel (Production + Preview)

| Variable | Description |
|----------|-------------|
| `SITE_URL` | Domaine canonique, ex. `https://zandofy.com` (aligné `VITE_SITE_URL`) |
| `SUPABASE_URL` | Même valeur que `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Même valeur que `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `FACEBOOK_APP_ID` | Optionnel — supprime l'alerte Meta Sharing Debugger |

Voir `frontend/.env.example`.

## Test après déploiement

```bash
curl -s -A "facebookexternalhit/1.1" "https://zandofy.com/product/<slug-publie>" | findstr /i "og:url og:image canonical BEGIN.injected"
```

**Succès :**

- `og:url` contient `/product/<slug>`
- `og:image` = URL HTTPS image produit (pas `og-default.jpg` si `product_images` en base)
- commentaire `BEGIN injected SEO (meta-injector edge fn)`

Répéter avec `WhatsApp/2.0`.

Sans User-Agent bot → SPA standard (normal).

## Cache Meta / WhatsApp

Après changement d'image : Admin SEO → re-scrape, puis [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) → **Re-collecter**. Cache Meta ~7 jours.

## Limites

- L'aperçu lien utilise l'**image principale** (`product_images`, `position` min), pas la vignette galerie sélectionnée à l'écran.
- Le texte `wa.me/?text=...` ne transporte pas l'image ; la vignette vient du scraping `og:image`.
- Catégories : pas de colonne `slug` — match `ilike` sur le nom.
