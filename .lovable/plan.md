

## Plan v4 — Pousser de 57 → 75+ sur mobile

### Constat sur le rapport actuel
Le test du **17 avril 08:31 UTC-4** montre encore l'**ancien bundle** (`index-C7b9Bwhv.js`) — la v3 (bootstrap unifié) **n'est pas encore déployée**. Les 22 requêtes séquentielles `platform_settings` y figurent toujours. Donc une partie du gain (~3-4 points LCP) viendra mécaniquement quand Vercel publiera la v3.

Mais pour viser **75+**, il faut 4 nouveaux leviers, tous non destructifs.

---

### Solution 1 — Précharger l'image LCP (gain LCP : ~1.5-2s)
**Problème** : la première image visible (bannière hero / featured placement) attend que React soit monté + que la requête `featured_placements` revienne (~1.6s) + que l'image se télécharge (~500ms). Total : 3-4s avant LCP.

**Solution** : Server-side, ajouter un `<link rel="preload" as="image" href="..." fetchpriority="high">` dans `index.html` pour la bannière hero principale (URL stable connue à l'avance).

**Comment** : la bannière hero principale est rarement modifiée → on hardcode son URL dans `index.html` (ou via une variable de build). Si elle change un jour, on update `index.html`. Coût : 0 UX, gain énorme.

**Alternative douce** : un edge function `bootstrap-html` qui injecte le preload dynamiquement, mais c'est plus complexe — gardons simple.

---

### Solution 2 — Cache long sur les images Supabase Storage (gain : 2 Mo économisés sur visites répétées + meilleur score Lighthouse)
**Problème** : TTL actuel **1h**. Lighthouse pénalise tout ce qui est < 1 mois.

**Solution** : Migration storage policy → `Cache-Control: public, max-age=31536000, immutable` pour tous les buckets `product-media`, `cms-assets`. Les noms de fichiers sont déjà horodatés (`1773741765164-0.webp`) donc safe pour `immutable`.

**Comment** : 
- Nouveaux uploads : ajouter `cacheControl: "31536000"` dans tous les `supabase.storage.upload()` du code.
- Anciens fichiers : un script SQL one-shot ou via l'API metadata storage pour mettre à jour les headers existants.

**Impact UX** : zéro. Les images ont des noms uniques → pas de problème de cache obsolète.

---

### Solution 3 — Lazy-load agressif des composants below-the-fold (gain TBT + LCP : ~1s)
**Problème** : `Index.tsx` charge **synchroniquement** : Header, HeroBanner, CategoryBanner, FlashSales, RecommendationsSection, FeaturedSidebar, TopTrends, ProductGrid, Footer, FloatingActions. Tous évalués au premier render → bloque le main thread.

**Solution** : `React.lazy()` + `Suspense` pour tout ce qui est sous le fold initial mobile (412px de haut visible) :
- Garder eager : Header, HeroBanner, CategoryBanner (visible en haut)
- Lazy : FlashSales, RecommendationsSection, TopTrends, FeaturedSidebar, ProductGrid, Footer, FloatingActions

**Comment** : Wrapper avec `IntersectionObserver` (déjà dispo via `useLazyImage`). Composant `<LazyMount>` qui ne monte le children qu'à l'approche du viewport.

**Impact UX** : invisible (les sections apparaissent avant que l'utilisateur ne scrolle), sauf un flash possible 50ms — mitigé avec un skeleton de la bonne hauteur (donc bonus CLS).

---

### Solution 4 — Réduire le bundle JS initial (gain TBT : ~80ms)
**Problème** : `react-vendor` + `index.js` = ~600 KB+ chargés au démarrage. Beaucoup de code admin/dashboard/checkout n'est jamais utilisé sur la home.

**Solution** : Vérifier que les routes admin/dashboard/checkout sont déjà en `lazy()` dans `App.tsx`. Sinon, les passer en lazy. Si c'est déjà fait → audit des imports globaux dans `App.tsx` qui tirent du code partout (ex: `framer-motion` chargé même si la home ne l'utilise pas).

**Action** : audit du graph de dépendances avec `vite-bundle-visualizer` ou simple recherche d'imports `@radix-ui` non utilisés sur la home.

---

### Solution 5 — Fix bug React `fetchPriority` (cleanup)
Dans les logs : `React does not recognize the fetchPriority prop`. C'est une régression v3 sur `BrandLogo.tsx`. React 18 supporte `fetchPriority` (camelCase) mais pas sur tous les éléments. Il faut soit downgrade en `fetchpriority` (lowercase) si c'est natif HTML, soit n'appliquer la prop que si supportée.

**Impact** : retire 1 warning sale en console + permet à Lighthouse de calculer correctement la priorité.

---

### Récap impact attendu

| Solution | Gain LCP | Gain TBT | Gain CLS | Gain Score |
|---|---|---|---|---|
| Déploiement v3 (déjà codé) | -3s | -50ms | -0.05 | +8 |
| 1. Preload image LCP | -1.5s | 0 | 0 | +5 |
| 2. Cache long images | 0 | 0 | 0 | +3 (Lighthouse audit) |
| 3. Lazy components below fold | -0.8s | -80ms | 0 | +6 |
| 4. Audit bundle JS | -0.3s | -50ms | 0 | +2 |
| 5. Fix fetchPriority | 0 | 0 | 0 | +0 (cleanup) |
| **Total estimé** | **-5.6s** | **-180ms** | **-0.05** | **+24 → ~80** |

---

### Ordre d'implémentation recommandé
1. **Solution 5** (fix bug, 5 min) — propre tout de suite
2. **Solution 1** (preload LCP, 15 min) — impact immédiat
3. **Solution 3** (lazy components, 30 min) — gros gain TBT
4. **Solution 2** (cache long, 30 min — migration + code) — gain durable
5. **Solution 4** (audit bundle, optionnel) — finition

### Ce qui ne change PAS
- Aucune modification visuelle perçue par l'utilisateur
- Aucune fonctionnalité retirée
- Aucune dépendance supprimée
- Aucune modification de la base de données (sauf cache headers storage)
- Pull-to-refresh, animations, scroll, transitions : intacts

### Risques
- **Solution 1** : si tu changes l'image hero un jour, il faut updater `index.html`. Mitigation : commentaire visible + check au déploiement.
- **Solution 3** : un skeleton mal calibré peut introduire un mini-flash. Mitigation : on calque les hauteurs exactes des composants actuels.
- **Solution 2** : aucune image existante ne sera invalidée car les noms sont horodatés.

### Décision attendue
Confirme que tu veux que j'enchaîne **les 5 solutions** d'un coup (recommandé), ou seulement un sous-ensemble.

