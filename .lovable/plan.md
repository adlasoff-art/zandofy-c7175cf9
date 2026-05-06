
# Plan de performance mobile (Zandofy)

## Constat (PageSpeed mobile, 6 mai)

- **Score Performance : 47/100** (rouge).
- **CrUX terrain (28 j)** : LCP 7,6 s · FCP 4,7 s · INP 472 ms · CLS 0,17 · TTFB 1,3 s. Échec Core Web Vitals.
- **Lighthouse lab** : LCP 9,9 s · FCP 4,3 s · TBT 400 ms · CLS 0,087.
- **LCP breakdown** : 2 790 ms de "resource load delay" → l'image LCP attend la fin de la chaîne JS+CSS+API avant d'être déclenchée.
- **Coupables identifiés** :
  1. Préload LCP en dur dans `index.html` (Unsplash) qui ne correspond plus à la vraie image LCP servie par le hero CMS (`MÉGA SOLDE 2026` sur `vpttoqojmiqxgudknyxf.supabase.co`). Le preload Unsplash est gaspillé, le vrai LCP n'est pas préchargé.
  2. `ipapi.co` bloque la chaîne critique (~2,3 s) pour de la géoloc non essentielle au premier rendu.
  3. Bundle d'entrée : `charts-vendor` (111 Kio recharts), `motion-vendor` (44 Kio) et `radix-vendor` (44 Kio) chargés à la racine alors qu'ils ne sont pas nécessaires au LCP.
  4. Préchargement de **5 familles Google Fonts** alors qu'une seule (Inter) suffit avant interaction. 32 Kio Outfit téléchargés inutilement.
  5. Préconnect manquants : `wgidwyrdnboivfphwete.supabase.co` (CDN images legacy) et `vpttoqojmiqxgudknyxf.supabase.co` (déjà ok). Préconnect inutile : `fonts.googleapis.com` (déjà connecté indirectement).
  6. CLS 0,087 : section catégories sans `min-height` correct, **logo header sans width/height** (signalé "Unsized image element").
  7. `forced reflow` 333 ms dans `react-vendor` : layout effects qui mesurent la DOM (probablement carrousel hero). À profiler en lot 4.
  8. Images produits servies parfois en **original `.webp` 453 Kio** (pas via `/render/image?width=…`) — `OptimizedImage` n'est pas encore branché partout.
  9. Cache TTL 1 h sur les images Supabase Storage → faible. À pousser à 1 an pour les médias hashés.

## Principes

- Aucun changement de schéma DB.
- Aucun changement business / pricing / RLS.
- 100 % côté frontend (`frontend/index.html`, `src/`) + 1 micro-tweak `vercel.json` (headers de cache).
- Chaque lot est livrable et testable indépendamment, rollback trivial.

## Lot 1 — LCP & critical path (impact attendu : LCP −3 à −4 s)

1. **Supprimer le préload Unsplash obsolète** dans `frontend/index.html` (il ne matche plus la vraie image LCP) et le remplacer par un preload **dynamique** : un petit script inline qui lit la première bannière `hero_slide` depuis `localStorage` (stockée au précédent passage) et insère un `<link rel="preload" as="image" fetchpriority="high">` correspondant. Au premier passage : pas de regression, on bénéficie au 2ᵉ.
2. **Ajouter les bons préconnect** : `https://wgidwyrdnboivfphwete.supabase.co` (CDN legacy, beaucoup d'images encore servies depuis là), retirer Unsplash (pas critique).
3. **Différer `ipapi.co`** : déplacer l'appel `use-geo-detection` derrière un `requestIdleCallback` (fallback `setTimeout(…, 1500)`). Aucune feature ne dépend de la géo dans le above-the-fold.
4. **Logo header** : ajouter `width`/`height` explicites dans `Header.tsx` (corrige "Unsized image element" → CLS).

## Lot 2 — Bundle splitting (impact attendu : FCP −1 s, TBT −150 ms)

1. **Recharts dynamique** : convertir tous les imports `recharts` (admin/vendor analytics) en `React.lazy`. La home n'a aucun graphique, donc 111 Kio de moins au boot.
2. **Framer-motion** : home n'utilise des animations que sur sections en dessous de la fold. Lazy-mount déjà en place via `LazyMount` ; vérifier que les composants animés sont bien dans des `lazy()` (FlashSales, RecommendationsSection, TopTrends sont déjà `lazy`, mais `Index.tsx` importe encore certains modules motion top-level — à auditer).
3. **Manualchunks Vite** : configurer `build.rollupOptions.output.manualChunks` pour isoler `recharts` dans un chunk **seulement** chargé par les pages admin/vendor (déjà partiel, à compléter pour qu'il ne soit jamais en `entry`).
4. **Polices** : retirer le bloc preload des 5 familles secondaires d'`index.html`. Ne charger Outfit/DM Sans/etc. **que** si l'admin a configuré une police personnalisée via `usePlatformFont` (déjà côté JS). Garder uniquement Inter render-blocking.

## Lot 3 — Images & cache (impact attendu : LCP −1 s, transferts −1 Mo)

1. **Brancher `OptimizedImage` partout** où il manque encore : bannières hero (`HeroBanner`), catégories CMS, vitrine produits sur la home. Aujourd'hui plusieurs images produits sont servies en original (453 Kio + 413 Kio visibles dans le rapport).
2. **Largeurs ciblées** : sur mobile, le srcset doit inclure `200/400/600` (déjà fait dans `OptimizedImage`) — vérifier qu'on ne demande pas `quality=70` sur des images déjà compressées par le watermark (perte qualité visible). Bumper à `quality=75` pour les hero (LCP).
3. **Cache headers** dans `frontend/vercel.json` : ajouter `Cache-Control: public, max-age=31536000, immutable` pour `/assets/*` (Vite hash) — déjà probablement là, à vérifier. Ne pas toucher au TTL Storage (géré par Supabase).
4. **Format AVIF** : `OptimizedImage` peut ajouter un `<picture>` avec `format=avif` pour les navigateurs récents (Supabase Storage le supporte via `?format=avif`). −20 % de poids moyen.

## Lot 4 — INP, CLS & DOM (impact attendu : INP −150 ms, CLS −0,05)

1. **Forced reflow react-vendor 333 ms** : profiler avec `browser--start_profiling` sur la home, identifier le composant fautif (très probablement le carrousel `HeroBanner` qui mesure `offsetWidth` dans un `useLayoutEffect`). Remplacer par CSS pur `scroll-snap` ou par `ResizeObserver`.
2. **DOM 6 818 nodes** : la grille catégories rend 113 enfants dans un seul scroller. Mettre en place un rendu paginé (charge initiale 18, "voir plus" pour le reste) sur mobile.
3. **CLS section catégories** : remplacer `min-height: 180px` inline par une grille avec `aspect-ratio` calculé pour éviter le saut quand les images chargent.
4. **Préchauffer `<Index>`** déjà via Vite — vérifier que `prefetch` est activé sur les routes secondaires (Header `<Link>`).

## Détails techniques (réservé tech)

- Préload dynamique LCP : script inline ~10 lignes, lit `localStorage['lcp-hero-url']`, set par `HeroBanner` après premier rendu via `useEffect`.
- `use-geo-detection` : enrober l'appel fetch dans `if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 }); else setTimeout(run, 1500);`. Aucun consommateur (use-customer-location, useGeoBlocking) n'est synchrone à l'init.
- Vite `manualChunks` : forcer `if (id.includes('recharts')) return 'charts-vendor';` mais le retirer de `optimizeDeps.include` pour qu'il ne soit pas pré-bundlé en entry.
- AVIF Supabase : `?format=avif&width=…&quality=75` ; fallback automatique via `<picture>`.
- Aucun changement DB, RLS, Edge Function. Aucun changement i18n. Aucun changement de tarification.

## Validation

- Après chaque lot : relancer PageSpeed mobile sur `https://zandofy.com/` et comparer LCP/FCP/INP/CLS.
- Smoke test manuel : home, page produit, panier, login. Aucun e2e n'est touché.
- Cible globale : Performance ≥ 75 (lab) et CrUX LCP < 4 s d'ici 28 j.

