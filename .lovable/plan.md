
## Contexte

Score mobile actuel : **54** (FCP 4.3 s, **LCP 7.8 s**, TBT 224 ms, CLS 0.09).

Le rapport PageSpeed pointe **3 vrais problèmes** qui n'ont rien à voir avec la qualité du code applicatif — ils relèvent de la livraison des assets et du graph d'imports. Tout est corrigeable sans toucher à une seule fonctionnalité métier (checkout, RLS, edge functions, paiements, etc. restent identiques).

```text
LCP breakdown actuel :
  TTFB                    0 ms      ✅
  Resource load delay  3 120 ms     ❌  ← cible #1
  Resource load duration 340 ms     ✅
  Element render delay    50 ms     ✅
```

Le délai de 3,12 s vient du fait que l'image LCP (bannière hero) n'est découverte par le navigateur qu'**après** le téléchargement et l'exécution de plusieurs chunks JS, **et** elle est servie par `wgidwyrdnboivfphwete.supabase.co` (staging) qui n'a aucun preconnect.

---

## Levier 1 — Migrer les images legacy de staging vers prod (impact LCP majeur)

**Constat** : ~1,1 MB d'images publiques sur la home pointent encore vers `wgidwyrdnboivfphwete.supabase.co` (projet staging) :
- `cms-assets/categories/*` — 9 images de catégories
- `cms-assets/branding/header_logo_url-*.svg` — le logo du header
- `product-media/f6808c6d-*` et `product-media/19f5badc-*` — images produits flash sales (jusqu'à 453 KB et 413 KB chacune)

**Pourquoi ça plombe le score** :
1. Domaine non-préconnecté → +200 à 400 ms de DNS+TCP+TLS sur chaque image (mobile 4G)
2. Storage staging n'est pas derrière le CDN Cloudflare qu'on a sur prod
3. Cache TTL court (1h) côté staging
4. Le navigateur ouvre 2 connexions séparées (prod + staging) au lieu d'une seule

**Action** : audit SQL + script de migration des URLs. Aucun code applicatif touché.

```sql
-- Audit (read-only) — combien de lignes par table contiennent encore des URLs staging
select 'cms_banners' as t, count(*) from cms_banners where image_url like '%wgidwyrdnboivfphwete%'
union all select 'categories', count(*) from categories where image_url like '%wgidwyrdnboivfphwete%'
union all select 'platform_settings', count(*) from platform_settings where value::text like '%wgidwyrdnboivfphwete%'
union all select 'product_images', count(*) from product_images where image_url like '%wgidwyrdnboivfphwete%'
union all select 'products', count(*) from products where main_image_url like '%wgidwyrdnboivfphwete%';
```

Pour chaque ligne identifiée :
- soit l'objet existe déjà dans le storage prod (bucket de même nom) → simple `UPDATE` du domaine dans l'URL
- soit l'objet n'existe que sur staging → script Node qui télécharge depuis staging et upload sur prod (`vpttoqojmiqxgudknyxf` — service-role key prod), puis UPDATE

**Stabilité garantie** : on procède table par table, on commit à chaque étape, on garde un script de rollback (mapping ancien_url → nouveau_url). Aucune fonctionnalité ne change : seules les URLs `image_url`/`main_image_url` sont réécrites.

---

## Levier 2 — Sortir `framer-motion` du chunk de la home (-43 KB JS, -39 KB inutilisés)

**Constat** : `motion-vendor` (43 KB) est chargé sur la home alors qu'il n'y est jamais utilisé. La cause : `App.tsx` importe statiquement `<CompareBar />`, qui dépend de `framer-motion`.

```text
App.tsx (eager)
  └─ CompareBar.tsx (eager)
       └─ framer-motion  ← 43 KB sur la home pour rien
```

**Action** :
- Convertir `CompareBar` en lazy dans `App.tsx` :
  ```ts
  const CompareBar = lazy(() => import("@/components/CompareBar").then(m => ({ default: m.CompareBar })));
  ```
- L'envelopper dans un `<LazyMount>` (composant qui existe déjà) ou un simple `<Suspense fallback={null}>` — la compare bar n'apparaît visuellement que quand l'utilisateur ajoute un produit à comparer, donc aucun impact UX.

**Stabilité** : la fonctionnalité Compare reste intacte. Le contexte `CompareProvider` reste eager (juste de l'état React), seul le composant visuel devient paresseux.

---

## Levier 3 — Marquer la première image hero comme préchargeable côté serveur (LCP -1 à -2 s)

**Constat** : actuellement on stocke l'URL hero LCP dans `localStorage` au premier visit, puis on l'injecte au boot suivant. Premier visit = aucun preload. Le navigateur découvre l'image seulement après React render → 3,12 s de delay.

**Action — sans backend, zéro risque** :
1. Dans `frontend/api/meta-injector.ts` (qui injecte déjà du SSR meta), ajouter la lecture de la première `cms_banners.image_url` (position=`hero_slide`, sort_order asc) avec cache mémoire 60 s, et l'injecter dans `<head>` :
   ```html
   <link rel="preload" as="image" href="https://vpt...yxf.supabase.co/.../hero-1.webp" fetchpriority="high">
   ```
2. Garder le mécanisme `localStorage` actuel comme **fallback** si l'injecteur échoue (Vercel cold start, etc.).

**Validation** : le rapport actuel montre que l'attribut `<img fetchpriority="high">` est déjà présent côté React — il manque juste le preload **avant** que le bundle JS soit téléchargé.

**Stabilité** : `meta-injector.ts` est déjà branché côté Vercel, on ajoute une seule clé. En cas d'erreur réseau Supabase, on retombe silencieusement sur le comportement actuel.

---

## Levier 4 — Réduire les requêtes API parallèles au boot (TBT et FCP)

**Constat** : ~25 requêtes REST sont émises au boot, dont plusieurs requêtes `platform_settings?key=eq.X` séparées (cms_texts, topbar_config, maintenance_mode, seo_enabled, visual_search_enabled, cookie_settings, app_promo). Chacune = round-trip + parse JSON.

**Action — chirurgicale, aucune logique métier touchée** :
- Étendre `platform-bootstrap` (edge function déjà existante) pour retourner d'un coup tout `platform_settings` dont la `key` est dans une whitelist publique (`cms_texts`, `topbar_config`, `maintenance_mode`, `seo_enabled`, `visual_search_enabled`, `cookie_settings`, `app_promo`).
- Côté hooks (`useSeoEnabled`, `useVisualSearchEnabled`, etc.), lire d'abord depuis le cache `usePlatformBootstrap`, et ne tomber sur la requête directe `platform_settings` que si la clé n'est pas présente (rétro-compat 100 %).

Gain estimé : -6 à -8 requêtes au boot, -300 à -500 ms sur 4G.

**Stabilité** : chaque hook reste fonctionnellement identique (même type de retour, même valeur par défaut). Si l'edge function échoue, on retombe sur les requêtes directes existantes.

---

## Ce qu'on NE TOUCHE PAS (protection des fonctionnalités)

- ❌ Pas de modif RLS, edge functions critiques (paiements, KelPay, Keccel, KYB, etc.)
- ❌ Pas de modif des contextes business (Cart, Wishlist, Compare logic, Auth)
- ❌ Pas de modif du checkout, des disputes, du sourcing, du tracking
- ❌ Pas de retrait du Service Worker ni changement de stratégie cache
- ❌ Pas de retrait de `framer-motion` côté admin/vendor (pages où il est légitime)

---

## Validation après déploiement

1. **Audit SQL** post-migration : `select count(*) from <chaque_table> where image_url like '%wgidwyrdnboivfphwete%'` → doit retourner 0.
2. **DevTools Network** sur `zandofy.com` : aucune requête vers `wgidwyrdnboivfphwete` au boot, `motion-vendor.js` absent du payload home.
3. **PageSpeed mobile** : LCP attendu < 4 s, score attendu 75+.
4. **Smoke test** : home, produit, panier, checkout, login, dashboard vendeur, dashboard admin → tous identiques fonctionnellement.

---

## Ordre d'exécution recommandé

1. **Levier 2** (lazy CompareBar) — 5 min, gain immédiat sur le bundle home, zéro risque
2. **Levier 1 audit SQL** — savoir exactement combien d'URLs migrer avant d'agir
3. **Levier 1 migration** — par lots, table par table
4. **Levier 3** (preload SSR) — après que le hero pointe sur prod
5. **Levier 4** (consolidation bootstrap) — gain marginal mais propre

Chaque étape est validable indépendamment via PageSpeed → on peut s'arrêter dès qu'on atteint la cible.
