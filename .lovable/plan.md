# Plan — Fix logo/texte + Optimisation PageSpeed

## Partie 1 — Bug visuel : logo & texte écartés (header + footer)

**Cause** (`frontend/src/components/BrandLogo.tsx`) : depuis le fix anti-CLS, le wrapper du logo réserve l'espace via `aspect-ratio: 3.5` sur un `<span>` qui n'a qu'une `height` (h-8/h-10/h-7). Tant que l'image n'est pas chargée, le wrapper occupe `height × 3.5` de largeur **vide** → le texte "Zandofy" est poussé loin à droite. C'est exactement ce qu'on voit sur ta capture (logo, gros vide, puis "Zandofy").

**Correctif** :
- Retirer le `aspect-ratio` du `<span>` wrapper en mode `logo_and_text` (le texte sert lui-même de réservation).
- Garder `width`/`height` HTML sur le `<img>` (suffisant pour éviter le CLS sans réserver de largeur fantôme).
- Réduire le `gap-2` à `gap-1.5` pour coller le texte au logo comme avant.
- Aligner verticalement avec `items-center` plutôt que `items-end` (évite que le texte « tombe » sous la baseline du logo).

Pas de changement en mode `logo_only` (où la réservation est légitime).

## Partie 2 — Plan PageSpeed restant

Le rewrite des URLs legacy (`wgidwyrdn...` → prod `vpttoqoj...`) est déjà fait, le mode maintenance est OK. Il reste 3 axes mesurables sur PageSpeed mobile.

### A. WebP + variantes responsives à la volée

**Constat** : les images produits/CMS sont servies en JPEG/PNG taille originale (souvent 1200-2000 px) même pour des miniatures de 300 px → poids 5-10× trop élevé.

**Solution** (sans backend custom) : utiliser le **Storage Image Transformation** Supabase (paramètres `?width=...&quality=...&format=webp` sur les URLs publiques `/render/image/`).

- Créer `frontend/src/lib/image-url.ts` : helper `transformImageUrl(url, { width, quality, format })` qui convertit `/storage/v1/object/public/...` en `/storage/v1/render/image/public/...?width=W&quality=80&format=webp`. Bypass si l'URL n'est pas Supabase.
- Brancher le helper dans les composants images-lourdes :
  - `ProductCard` (grilles catalogue, recherche, vitrines) → `width=400`
  - `ProductGallery` thumbnails → `width=120`, image principale → `width=800`
  - `CmsBanner` / `HeroSection` → `width=1280`, version mobile `width=640` via `srcSet`
  - `CategoryCard`, `StoreCard`, `BrandLogo` (footer/header), `BlogPostCard` → tailles adaptées
- Ajouter `srcSet` + `sizes` sur les composants principaux (cards et héros) pour servir 1×/2× selon DPR.

### B. Lazy-loading strict + decoding async

- Auditer toutes les balises `<img>` du projet : ajouter `loading="lazy"` partout sauf le 1er héros above-the-fold (qui garde `fetchpriority="high"`).
- Ajouter `decoding="async"` partout, et `decoding="sync"` uniquement sur le hero LCP.
- Vérifier que `IntersectionObserver` (`use-lazy-image.ts`) n'est utilisé que pour les images qui en bénéficient (sinon le natif suffit et est plus rapide).

### C. Preconnect, fonts & hints réseau

- Vérifier dans `frontend/index.html` qu'on a `<link rel="preconnect" href="https://vpttoqojmiqxgudknyxf.supabase.co" crossorigin>` (et retirer les preconnect vers le projet legacy s'il en reste).
- Ajouter `<link rel="dns-prefetch">` pour les CDN externes encore utilisés (analytics, etc.).
- Vérifier que les polices personnalisées (`Outfit`, font CMS injectée) sont en `font-display: swap` et préchargées (`<link rel="preload" as="font">`) uniquement pour les 1-2 graisses utilisées above-the-fold.

### D. Validation

1. PageSpeed mobile sur `https://zandofy.com` avant/après pour LCP, CLS, total bytes images.
2. DevTools Network → confirmer que les images du catalogue passent en `image/webp` avec un poids divisé par 3-5×.
3. Lighthouse local pour vérifier qu'aucune regression sur les PWA scores.

## Ordre d'implémentation suggéré

1. **Fix logo/texte** (5 min, 1 fichier) — corrige immédiatement le visuel cassé.
2. **Helper `transformImageUrl`** + branchement `ProductCard` (gain le plus visible sur la home et les listings).
3. **Branchement gallery / hero / banners**.
4. **Audit lazy-loading global** (chercher `<img` sans `loading=`).
5. **Preconnect / fonts** dans `index.html`.

## Détails techniques

- Le Storage Image Transformation Supabase est inclus dans Cloud, pas de coût additionnel pour une plateforme à 4000 users/jour à ce volume.
- Aucune migration SQL nécessaire.
- Aucun changement d'env var.
- Déploiement : merge `develop` → `main` → Vercel rebuild automatique.

## Hors scope (à traiter plus tard si besoin)

- Service Worker cache stratégique des images WebP (déjà en place via `sw.js`, juste à valider que les nouvelles URLs `/render/image/` sont matchées).
- Optimisation JS (code-split routes admin/operator) — gros chantier séparé.
