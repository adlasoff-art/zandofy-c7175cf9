

## Diagnostic SEO complet (problèmes Google Search Console)

### 1. Problème majeur : Zandofy est un SPA → Google reçoit du HTML vide
Le HTML brut servi sur **TOUTES** les pages (home, produit, boutique, catégorie) contient les **mêmes** balises `<title>`, `og:title`, `og:image` (icône PWA 512px), `description`. La logique React de `SEOHead.tsx` ne s'exécute **que dans le navigateur après hydratation JS**, donc Googlebot voit partout :
- Titre identique : "Zandofy — Mode Élégante & Accessible"
- Aucune balise `<link rel="canonical">` dans le HTML statique
- Image OG = icône 512×512 (pas conforme aux 1200×630 attendus)
- Aucun JSON-LD Product/BreadcrumbList dans le HTML

→ Conséquence directe : **142 pages "Détectée non indexée" + "Page en double sans canonique" + "Autre page avec balise canonique correcte"** dans la GSC. Google considère tous les produits comme des doublons.

### 2. Anciennes URLs WordPress qui apparaissent encore (ex: `/boutique`, `/support-client/`)
- `/boutique` n'existe plus dans `App.tsx` (seulement `/stores`)
- Aucune redirection 301 → SPA fallback retourne 200 + page vide
- → "Soft 404" + "Introuvable 404" dans GSC

### 3. Deux propriétés Search Console
- **Domaine** (`zandofy.com`, créée le 10 avril) = recommandée, capture HTTP+HTTPS+sous-domaines
- **Préfixe URL** (`https://zandofy.com/`, ancienne WordPress) = données historiques
→ **Garder les deux**, mais **soumettre le sitemap dans la version Domaine** et configurer la version Domaine comme principale.

### 4. Sitemap incomplet
- Aucune balise `<lastmod>` sur les catégories/boutiques
- Catégories utilisent encore `name` au lieu de `slug` → URLs encodées `auto%20%26%20engine`
- Pas de `hreflang` dans le sitemap

### 5. Breadcrumb fragile
URL breadcrumb produit utilise `categoryFr.toLowerCase()` → ne correspond pas aux vrais slugs catégorie → liens 404 potentiels.

---

## Solution en 4 axes

### Axe 1 — Pre-rendering / SSR pour les pages publiques (CRITIQUE)
Vercel supporte le **prerendering au build** via une stratégie statique. Deux options :

**A. Prerender script Node** (recommandé, sans changer de framework)
- Script post-build qui parcourt `sitemap-dynamic.xml`, lance Puppeteer/Playwright headless, génère un HTML statique par URL avec balises meta correctes, sauve dans `dist/product/{slug}/index.html` etc.
- Avantage : zéro refonte React, déploiement Vercel inchangé
- Limites : build plus long (≈3-5 min pour 200 produits)

**B. Edge Function `meta-injector`** (plus léger, recommandé en complément)
- Vercel Edge rewrite : intercepte requêtes Googlebot/Bingbot/Facebook (User-Agent) sur `/product/*`, `/category/*`, `/store/*`
- Va chercher les méta dans Supabase et injecte dans `index.html` avant de servir
- Tous les autres bots/users reçoivent le SPA normal

→ **Recommandation : Axe B (rapide à livrer, ~2 jours), puis Axe A en V2 si besoin.**

### Axe 2 — Nettoyage des anciennes URLs WordPress
Ajouter dans `frontend/vercel.json` des **redirects 301** :
```text
/boutique           → /stores      (301)
/support-client     → /faq         (301)
/wp-admin/*         → /            (410 idéalement)
/?p=*               → /            (301)
```
Identifier la liste exacte via export GSC "Pages non indexées > Introuvable 404".

### Axe 3 — Améliorer `index.html` (HTML statique amélioré, fallback)
Tant que le pre-rendering n'est pas en place :
- Mettre une vraie image OG 1200×630 (`/og-default.jpg`) au lieu de l'icône 512
- Ajouter `<link rel="canonical" href="https://zandofy.com/">` dans le HTML statique
- Ajouter le JSON-LD `Organization` + `WebSite` (sitelinks searchbox) **directement dans le HTML** (pas via React)
- → Permet à Google d'afficher le panneau Knowledge à droite

### Axe 4 — Sitemap & breadcrumb robustes
**`generate-sitemap` (edge function)** :
- Ajouter `<lastmod>` partout (catégories : `MAX(updated_at)` des produits de la catégorie)
- Utiliser `categories.slug` au lieu de `name`
- Ajouter `<image:image>` (extension Google) pour produits → boost richesse résultats

**`ProductPage.tsx` breadcrumb** :
- Lier au vrai slug catégorie (jointure DB), pas le `nameFr.toLowerCase()`
- Garantir cohérence avec sitemap

---

## Plan de livraison (3 lots)

| Lot | Contenu | Effort | Impact GSC |
|---|---|---|---|
| **Lot 1 — Quick wins (1 jour)** | OG image 1200×630 statique + canonical + JSON-LD Organization dans `index.html` + redirects 301 anciennes URLs WP + sitemap avec `lastmod` et `slug` | S | Knowledge panel + 404 réduits |
| **Lot 2 — Edge meta-injector (2 jours)** | Edge function Vercel qui détecte bots et injecte titre/desc/OG/JSON-LD dynamiques par URL produit/boutique/catégorie | M | Toutes pages indexables, fin du "doublon canonique" |
| **Lot 3 — Polish (1 jour)** | Breadcrumb produit sur vrais slugs + correction `<image:image>` sitemap + soumission Sitemap dans propriété "Domaine" GSC + demande de réindexation manuelle des 19 pages | S | Indexation accélérée |

---

## Ce que je propose maintenant

Démarrer **Lot 1 immédiatement** (impact rapide, faible risque), puis on enchaîne Lot 2 dès validation. Concrètement Lot 1 modifie :
- `frontend/index.html` — meta OG, canonical, JSON-LD Organization
- `frontend/public/og-default.jpg` — nouvelle image 1200×630 (à fournir ou je génère via gradient brand)
- `frontend/vercel.json` — bloc `redirects` 301
- `supabase/functions/generate-sitemap/index.ts` — `lastmod`, `slug` catégories, balise `<image:image>`

Pas de migration SQL nécessaire pour le Lot 1.

