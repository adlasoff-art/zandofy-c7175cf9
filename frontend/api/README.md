# Vercel Edge Function: meta-injector

Cette fonction n'est invoquée **que pour les bots** (Googlebot, Bingbot, Facebook, Twitter, LinkedIn, WhatsApp, etc.) sur les routes publiques dynamiques :

- `/product/:slug`
- `/store/:slug`
- `/category/:slug`
- `/blog/:slug`

## Pourquoi

Zandofy est une SPA React → le HTML statique servi par Vercel est identique pour toutes les pages. Sans pre-rendering, Google voit le même `<title>`, `og:image` et `description` partout, ce qui provoque :

- **Page en double sans canonique** dans Google Search Console
- **Détectée non indexée** sur les fiches produits
- Aucun rich snippet (Product, Store, Article)

## Ce que fait la fonction

1. Lit la requête entrante.
2. Vérifie si l'User-Agent est dans la liste blanche bots (régex). Si non → fallback (en pratique, le rewrite Vercel ne route que les bots ici).
3. Récupère `index.html` depuis le même déploiement Vercel.
4. Appelle Supabase REST (anon key) pour récupérer les méta réelles du produit / boutique / catégorie / article.
5. Strip les balises SEO statiques de `<head>` (`<title>`, `og:*`, `twitter:*`, `canonical`, `description`).
6. Injecte les balises dynamiques + JSON-LD Product/Store/CollectionPage/BlogPosting.
7. Retourne le HTML modifié avec `Cache-Control` (5 min edge, 10 min CDN, SWR 24h) et `Vary: User-Agent`.

## Sécurité

- Aucun secret. Anon key uniquement (visible dans le bundle frontend).
- Strict reads sur tables publiques (`products` filtrées sur `publish_status=published`, `stores`, `categories`, `blog_posts` filtrées sur `status=published`).
- Pas de pass-through utilisateur, pas de cookie, pas de header Auth.

## Test après déploiement

```bash
# Doit retourner du HTML avec <title> spécifique au produit
curl -A "Googlebot/2.1" https://zandofy.com/product/<slug-existant> | grep "<title>"

# Sans User-Agent bot → SPA standard (titre générique)
curl https://zandofy.com/product/<slug-existant> | grep "<title>"
```

Vérifier ensuite dans Google Search Console : **URL Inspection** sur une fiche produit → "Tester l'URL en direct" → onglet "HTML rendu" doit afficher le titre dynamique.

## Limites connues

- Les catégories n'ont pas de colonne `slug` en DB → on matche par `ilike` sur `name` / `name_fr` après dé-slugification basique. À améliorer en V2 (ajout colonne `slug` + index unique).
- Pas de pré-rendu pour les bots qui n'envoient pas un UA reconnu (rare).
