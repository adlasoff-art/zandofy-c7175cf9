
# Optimisation PageSpeed v2 (mobile + desktop)

## État actuel (rapport du 7 mai 2026, zandofy.com)

**Champ (CrUX 28j)** — échec Core Web Vitals :
- LCP 8,6 s (69 % des visites > 4 s)
- INP 581 ms (29 % > 500 ms)
- CLS 0,19 (mobile)
- TTFB 1,3 s

**Lab Lighthouse mobile** : score perf **59**, LCP 6,7 s, FCP 4,0 s, CLS 0,118, TBT 90 ms.

**Diagnostics clés** identifiés par Lighthouse :
1. **LCP breakdown** : resource load *delay* = **1 900 ms** → l'image hero est découverte trop tard, malgré le préload script déjà en place.
2. **CSS render-blocking** : `index-*.css` (23 KiB / 630 ms) bloque le 1er paint.
3. **Cascade réseau Supabase** : ~12 requêtes parallèles `platform_settings?key=eq.*` + `cms_banners*` + `categories*` toutes à 1,5–2 s ; chaîne critique de **3 943 ms** (analytics/automation events qui retardent FCP).
4. **DOM énorme** : **6 784 éléments** (Index rend ~50 produits dès le 1er paint + 113 enfants par carrousel catégorie).
5. **TTL cache faible** : images Supabase Storage = `Cache-Control: max-age=3600` (1 h) au lieu de 1 an immutable → 1 228 KiB perdus en revisite.
6. **Forced reflows** : 358 ms cumulés dans `react-vendor` + `radix-vendor` (probablement Dialog/Tooltip qui mesurent layout).
7. **2ᵉ projet Supabase parasite** : `wgidwyrdnboivfphwete.supabase.co` (staging) sert encore le logo SVG du header en prod → 310 ms LCP gaspillés.
8. **Preconnect inutilisé** : `vpttoqojmiqxgudknyxf.supabase.co` marqué unused (crossorigin mal calibré pour les images non-CORS).
9. **Bundles vendors trop lourds sur home** : `charts-vendor` 111 KiB, `motion-vendor` 44 KiB, `radix-vendor` 44 KiB chargés alors qu'ils ne servent pas au-dessus de la ligne de flottaison.
10. **CLS 0,118** : section "catégories" (`min-height: 180px` insuffisant) et bannière promo provoquent des shifts.

---

## Stratégie (5 lots, du plus rentable au plus subtil)

### Lot 1 — Casser la cascade `platform_settings` (gain estimé LCP −1,2 s)

**Problème** : 8 requêtes `platform_settings?key=eq.X` partent en parallèle dès l'app monte mais **bloquent React jusqu'à leur retour** (chacune 1,4–1,8 s sur 4G).

**Action** :
- Étendre `BOOTSTRAP_KEYS` dans `supabase/functions/platform-bootstrap/index.ts` pour englober **toutes** les clés lues au-dessus de la ligne de flottaison : `cookie_settings`, `cms_texts`, `app_promo`, `maintenance_mode`, `referral_settings`, `bulk_discount_tiers`, `free_shipping_threshold` (déjà), `topbar_config`, `footer_config`, `seo_enabled`, `cms_menu_items` (à dénormaliser dans la function).
- Refactorer les hooks/contexts qui interrogent `platform_settings` directement (`UIConfigContext`, `Header`, `Footer`, `CookieConsent`, `useActiveGeo`, `useVisualSearchEnabled`, `use-seo-enabled`, `use-maintenance-mode`, `I18nContext`) pour **lire d'abord** le payload `platform-bootstrap` (déjà cached côté CDN 5 min, SWR 1 h) et **fallback** sur la requête directe si la clé manque.
- Garder la même structure de retour côté hook (signature inchangée) → zéro impact métier.
- Étape 2 (suiveuse) : préfetch `platform-bootstrap` **dans `index.html`** comme on fait déjà pour `cms_banners?position=eq.hero_slide` (parallèle au bundle JS).

**Sécurité métier** : l'edge function utilise déjà `SERVICE_ROLE_KEY` server-side, lit uniquement les clés publiques whitelistées → aucune exposition.

### Lot 2 — Découverte LCP plus précoce (gain LCP −600 ms)

**Problème** : `resource load delay = 1900 ms`. Le préload script attend le retour de `cms_banners` (374 ms) **après** que `react-vendor` (176 ms) + `index.js` (255 ms) aient parsé.

**Actions** :
1. **Inliner le 1er hero slide dans le HTML** : nouvelle clé statique `hero_lcp_url` dans `platform_settings`, injectée par `frontend/api/meta-injector.ts` (Vercel edge) au moment du render initial → la balise `<link rel="preload">` est déjà présente dans le HTML servi (zéro round-trip).
2. **Supprimer `crossorigin` du preconnect Supabase** (Lighthouse l'a marqué inutilisé pour les images publiques non-CORS).
3. **Ajouter `<link rel="preconnect" href="https://wgidwyrdnboivfphwete.supabase.co">`** OU mieux : **migrer le logo SVG header** depuis le bucket staging vers le bucket prod (`vpttoqojmiqxgudknyxf`) → suppression de la 2ᵉ origine entière (gain 310 ms).
4. **`fetchpriority="high"` + `fetchpriority="low"`** : marquer les bannières *non-LCP* (hero_left, hero_right, categories) comme `loading="lazy"` + `fetchpriority="low"` pour ne pas concurrencer le LCP.

### Lot 3 — Shrink le DOM et différer les sections sous le pli (gain INP −150 ms, TBT −40 ms)

**Problème** : 6 784 nœuds (Lighthouse warning > 1 500). La home rend `FlashSales`, `TopTrends`, `RecommendationsSection`, `Categories carousels` simultanément avec ~50 `ProductCard`.

**Actions** :
- Wrapper `FlashSales`, `TopTrends`, `RecommendationsSection`, `MegaSale` dans un **`<section>` avec `content-visibility: auto`** + `contain-intrinsic-size` adapté → le browser skip layout/paint hors viewport sans changer le markup.
- Réduire le nombre initial de `ProductCard` rendues par section sur mobile (8 au lieu de 12) avec un "Voir plus" qui hydrate la suite — sans toucher aux requêtes (les données sont déjà là, on ne rend juste pas tout d'un coup).
- Simplifier les `ProductCard` : actuellement 6 spans badge (Cert, CN, MOQ, sold, discount×2, line-through) par carte → fusionner les 2 badges remise dupliqués (`-10%` apparaît 2× dans le DOM).

**Sécurité métier** : aucune logique business retirée — uniquement rendu différé.

### Lot 4 — Code-splitting agressif des vendors non-critiques (gain TBT −60 ms, transfert −150 KiB)

**Actions sur `frontend/vite.config.ts`** :
- Vérifier que `charts-vendor` (recharts/d3) n'est **pas** importé statiquement par un composant home → forcer un `lazy()` autour des composants admin/analytics qui l'utilisent.
- Idem `motion-vendor` (framer-motion) : remplacer par CSS `@keyframes` pour les ~3 animations home (hero parallax, fade, slide), et garder framer-motion pour les drawers/dialogs hydratés à l'usage.
- `CompareBar` (1,87 KiB) : ne charger qu'à partir d'un produit dans le compare (déjà fait ?) → vérifier import statique dans `App.tsx`.

### Lot 5 — Headers cache + CLS résiduel (gain perçu visite 2)

**Actions Vercel/Storage** :
- Ajouter une règle `vercel.json` pour `/assets/*-[hash].(js|css|woff2)` → `Cache-Control: public, max-age=31536000, immutable` (probablement déjà en place ; à vérifier).
- **Pour les images Supabase Storage** : on ne peut pas allonger le TTL au-delà de 1 h sans toucher au bucket public. Migration vers `?cache-control=31536000` à l'upload côté `image-compress.ts` + edge function `watermark-image` (les nouvelles uploads en bénéficient automatiquement, anciennes restent à 1 h — acceptable).
- **CLS** : passer `min-height: 180px` à `min-height: 200px` sur la section catégories ; sur `Bannières promo`, ajouter `aspect-ratio: 1200/380` au wrapper `<div>` parent.

---

## Détails techniques (pour Cursor/dev)

```text
Cascade actuelle (Initial nav → LCP)
├─ HTML  128 ms
├─ supabase-vendor.js  186 ms  ─┐
├─ 8× platform_settings        ├─ TOUS bloquent ≈ 1800 ms
├─ cms_menu_items              │
├─ categories                  │
├─ cms_banners×3               ┘
└─ products×2  ≈ 2100 ms → LCP image découverte ≈ 1900 ms

Cascade cible
├─ HTML  128 ms
├─ <link preload hero>  ← injecté server-side  ──→ image démarre 0 ms
├─ supabase-vendor.js  186 ms
├─ 1× platform-bootstrap (CDN cached)  ≈ 200 ms  ←
└─ products  ≈ 800 ms → LCP < 2 s
```

**Fichiers touchés** (estimation) :
- `supabase/functions/platform-bootstrap/index.ts` (étendre la whitelist + ajouter `cms_menu_items`)
- `frontend/src/hooks/use-platform-bootstrap.ts` (exposer plus de clés)
- `frontend/src/contexts/UIConfigContext.tsx`, `I18nContext.tsx` (lire bootstrap d'abord)
- `frontend/src/components/Header.tsx`, `Footer.tsx`, `CookieConsent.tsx` (idem)
- `frontend/src/hooks/{use-maintenance-mode,use-seo-enabled,useVisualSearchEnabled,useActiveGeo}.ts`
- `frontend/api/meta-injector.ts` (injection `<link rel=preload>` server-side)
- `frontend/index.html` (preconnect cleanup, preload statique éventuel)
- `frontend/src/pages/Index.tsx` (content-visibility wrappers, limit initial render)
- `frontend/src/components/ProductCard.tsx` (dédupliquer badges discount)
- `frontend/src/components/HeroBanner.tsx` (`fetchpriority` sur sous-bannières)
- `frontend/vite.config.ts` (audit imports statiques charts/motion)
- `frontend/vercel.json` (vérifier headers cache assets)
- migration logo SVG (via SQL `UPDATE platform_settings` — fournira un fichier `.sql` téléchargeable)

**Aucune migration de schéma**. **Aucune nouvelle variable d'environnement**. Métier 100 % préservé (toutes les clés `platform_settings` continuent d'exister, juste regroupées dans une réponse).

---

## Ordre d'implémentation recommandé

1. **Lot 1** (le plus gros gain, 1 fichier edge function + ~10 fichiers frontend pour basculer la lecture).
2. **Lot 2** — partie 3 (migration logo) + partie 2 (cleanup preconnect) — quick wins.
3. **Lot 5 partie CLS** (10 min, isolé).
4. **Lot 3** content-visibility (faible risque, gros visuel sur INP).
5. **Lot 2** partie 1 (meta-injector hero) — un peu plus délicat (Vercel edge).
6. **Lot 4** code-split (audit + tests).

À chaque lot : déploiement `develop` → mesure PageSpeed sur `studio.zandofy.com` avant merge `main`.

**Objectif chiffré** :
- Lab perf mobile **59 → 85+**
- LCP champ **8,6 s → < 4 s** (sortir du rouge)
- INP champ **581 ms → < 300 ms**
- CLS champ **0,19 → < 0,1**
