
## Décision validée

Titre par défaut de la home : **« Zandofy — Marketplace sino-africaine | Achat à l'international et livraison en Afrique »** (78 car).

Comme c'est > 60 car (limite SEO recommandée pour éviter la troncature Google), je seed deux versions :
- **`<title>`** (affiché Google, ≤60 car) : « Zandofy — Marketplace sino-africaine d'import »
- **`og:title` / `meta description`** (riche, plus long) : ta phrase complète.

Tu pourras éditer les deux dans le CMS si tu préfères ta version longue partout.

## Problèmes adressés

1. `https://zandofy.com/auth` indexé en 1ère position avec « Aucune information ».
2. Aucun contrôle admin par page — tout passe par le `seo_config` global.
3. Titres auto `Label | Zandofy` non personnalisables.
4. Sitelinks type Amazon à renforcer.

## Livrables

### A. Bloquer les pages privées de l'index Google

- `frontend/public/robots.txt` : ajouter `Disallow: /auth`, `/reset-password`, `/onboarding`, `/impersonate` (vérifier que `/dashboard`, `/admin`, `/checkout`, `/cart` sont déjà bloqués).
- Ajouter `<SEOHead>` avec `noindex,nofollow` sur `AuthPage`, `ResetPassword`, `OnboardingPage`, `ImpersonatePage`.
- Note manuelle GSC (à faire toi-même après déploiement) : Search Console → Suppressions → demander suppression temporaire de `https://zandofy.com/auth`.

### B. Contrôle admin par page (style RankMath)

Nouvelle table Supabase `seo_page_overrides` :

| colonne | type | rôle |
|---|---|---|
| `path` (PK) | text | `/`, `/stores`, `/pricing`… |
| `title` | text | `<title>` (≤60 idéal) |
| `og_title` | text | titre Open Graph long (optionnel) |
| `description` | text | meta description (≤160) |
| `og_image` | text | URL image OG override |
| `keywords` | text[] | mots-clés |
| `robots` | text | `index,follow` ou `noindex,nofollow` |
| `jsonld_extra` | jsonb | JSON-LD additionnel |
| `updated_at` | timestamptz | |

- RLS : SELECT public, INSERT/UPDATE admins uniquement.
- Migration de seed avec les 13 routes globales : home, /stores, /pricing, /about, /faq, /help, /careers, /blog, /privacy, /terms, /popular, /trends, /search.

Nouvelle UI **Admin → SEO → onglet « Pages »** :
- Tableau des routes avec champs éditables (Title, OG title, Description, OG image, Indexable toggle, Keywords).
- Compteur de caractères en direct (vert ≤60, orange 60-70, rouge >70 pour title).
- Aperçu SERP en direct par ligne (réutilise `SeoSerpPreview`).
- Bouton « Purger cache crawler » (réutilise hook existant du `meta-injector`).

### C. Wiring runtime

- **`meta-injector.ts`** (Vercel edge, bots) : avant `buildGlobalMeta`, chercher l'override pour `pathname` dans `seo_page_overrides` (cache 60s en mémoire). Si trouvé → utiliser. Sinon → fallback actuel.
- **`SEOHead.tsx`** (humains + bots non couverts) : nouveau hook `useSeoOverride(path)` qui lit l'override depuis le cache `platform-bootstrap`, l'utilise comme valeur par défaut quand la page n'a pas de title/description explicite.
- **`platform-bootstrap`** : ajouter une 2ème requête `seo_page_overrides` à la réponse pour éviter une query supplémentaire au premier rendu.
- **`vercel.json`** : étendre la règle `globalPath` pour inclure `auth|reset-password` (afin que les bots reçoivent immédiatement le `noindex` côté serveur).
- **`Index.tsx`** : utiliser `seo_page_overrides['/']?.title` si présent, sinon le `seo_config.site_title` actuel.

### D. Renforcer les sitelinks (objectif Amazon-like)

- Vérifier la cohérence du `SiteNavigationElement` JSON-LD dans `index.html` avec les labels du menu et les nouveaux titres `seo_page_overrides`.
- Confirmer que `WebSite + SearchAction` JSON-LD est bien présent sur la home (déjà fait dans `Index.tsx` ✓).
- Confirmer `Organization` JSON-LD (logo + sameAs) (déjà fait dans `Index.tsx` ✓).
- Sitemap : vérifier priorités 0.9–1.0 pour les 8 sections nav.
- Action manuelle après déploiement : GSC → soumettre sitemap, demander indexation des 8 sections nav.

## Détails techniques

- **Stack** : modifs livrées via GitHub Actions vers prod (`vpt...yxf`) selon SOP.
- **Migration SQL** : nouvelle table + seed dans `frontend/supabase/migrations/` (à rejouer sur prod ET staging).
- **PWA versioning** : ce changement modifie `SEOHead.tsx` côté client → nécessite bump mineur **1.10.0** + push notif update. Je te demanderai l'OK explicite avant le bump (protocole PWA). Si tu préfères le grouper avec le Lot 3 (paiement carte), on peut différer le bump.
- **Aucune modif** des fichiers déploiement-sensibles (Docker, ports, domaines).

## Hors scope

- Per-product/per-store SEO override avancé (reste basé sur nom+description DB).
- Multi-langue hreflang `en/zh` (reste `fr` + `x-default`).
- API GSC pour suppression auto (manuel).

J'attends ton « go » pour implémenter, et la décision sur le bump 1.10.0 (maintenant ou groupé avec Lot 3).
