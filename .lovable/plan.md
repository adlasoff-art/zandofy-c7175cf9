# Audit lenteur images — Flash Sales et cartes produit

## Diagnostic

Mesures à partir du code (`FlashSales.tsx`, `ProductCard.tsx`, `OptimizedImage.tsx`, `use-lazy-image.ts`) :

1. **Double chargement systématique par carte**. `ProductCard` rend *toujours* `OptimizedImage` pour `product.image` ET pour `secondImage` (image de survol), même quand la souris n'a jamais survolé la carte et même sur mobile (pas de hover). Le navigateur télécharge donc **2 images par produit**, soit ~16 fichiers pour la rangée Super Promo. Sur mobile c'est 100% de bande passante gaspillée.

2. **Toutes les cartes Flash Sales se déclenchent en même temps**. Le scroll horizontal place les 8 cartes dans le viewport simultanément → `useLazyImage` les marque toutes `inView` en même temps → 8 (×2 avec point 1 = 16) requêtes parallèles vers `/storage/v1/render/image/...`. L'endpoint Supabase Image Transformation est lent au premier hit (resize à la volée), donc beaucoup de requêtes concurrentes saturent le navigateur et l'origine.

3. **Tailles `srcset` trop larges pour le slot réel**. Les cartes font 155–170 px CSS (`min-w-[155px]` / `md:min-w-[170px]`). `OptimizedImage` propose `widths={[200, 400, 600]}` avec `sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 240px"`. Sur mobile 50vw ≈ 190 px → le navigateur choisit la variante 400w (×2 = 800 px d'image pour afficher 190 px). Idem desktop : 240 px de slot, on sert du 400w. Surdimensionné d'un facteur ~2.

4. **Qualité 70 sur des vignettes**. Acceptable mais 60 suffit largement à cette taille et économise ~20 % de poids.

5. **Pas de hiérarchisation**. Les 2–3 premières cartes visibles devraient être prioritaires, le reste différé. Aujourd'hui tout est traité avec la même priorité, donc le navigateur partage la bande passante équitablement et rien n'arrive vite.

6. **Cache CDN OK** : les URLs Supabase render sont déterministes (même query string), donc une fois chauffées elles passent en cache. Le problème vient des premiers hits + du volume.

## Plan d'optimisation (frontend uniquement, zéro changement backend)

### 1. `frontend/src/components/ProductCard.tsx` — supprimer le pré-chargement de l'image de survol
- Ne rendre `<OptimizedImage secondImage>` **que** lorsque `hovered === true` (et conserver une transition d'opacité simple via `key` ou montage différé).
- Gain attendu : −50 % de requêtes images sur toutes les pages avec ProductCard, surtout sur mobile.

### 2. `frontend/src/components/ProductCard.tsx` — resserrer `widths` / `sizes` / `quality`
- `widths={[160, 240, 360]}` (couvre DPR 1/1.5/2 pour un slot 155–170 px).
- `sizes="(max-width: 640px) 50vw, 170px"` (sans étape intermédiaire trompeuse).
- `quality={60}` au lieu de 70 pour les vignettes.
- Gain : −40 à −60 % de poids par image.

### 3. `frontend/src/components/FlashSales.tsx` — prioriser les 2 premières cartes
- Passer une prop `priority` à `ProductCard` (et au final à `OptimizedImage`) pour `index < 2` : `fetchpriority="high"` + `loading="eager"`.
- Les autres restent en `loading="lazy"` natif et perdent la dépendance à `useLazyImage` (qui de toute façon les active toutes en bloc).

### 4. `frontend/src/components/ProductCard.tsx` — retirer le gate IntersectionObserver redondant
- Supprimer `useLazyImage` pour le rendu (garder éventuellement le `ref` pour analytics). S'appuyer sur `loading="lazy"` + `fetchpriority` natifs.
- Bénéfice : le navigateur planifie mieux les téléchargements (queue progressive selon la visibilité réelle au scroll, pas un burst quand la section entière apparaît).
- Le skeleton shimmer reste affiché tant que `onLoad` n'a pas tiré.

### 5. `frontend/src/components/OptimizedImage.tsx` — petites finitions
- Quand `widths.length` est faible, ne pas générer 5 URLs inutiles : passer `widths` reçus tels quels (déjà le cas, juste vérifier qu'on ne retombe pas sur les `DEFAULT_WIDTHS`).
- Aucune modif d'API publique.

## Détails techniques

- Pas de migration, pas de fonction edge, pas de changement Supabase.
- Cible : `frontend/src/components/ProductCard.tsx`, `frontend/src/components/FlashSales.tsx`, éventuellement `frontend/src/components/OptimizedImage.tsx`.
- Compatible avec les autres consommateurs de `ProductCard` (ProductGrid, TopTrends, Recommendations) — ils bénéficient des mêmes gains sans changement d'appel.
- Vérification : recharger `/`, observer DevTools → Network → Img : moins de requêtes, poids < 20 ko / vignette, premières images Super Promo dans le viewport servies avec `fetchpriority=high`.

## Hors scope (à confirmer si tu veux que je traite aussi)

- Erreur runtime actuelle « No QueryClient set » visible dans le preview Lovable — ne touche pas la prod si ton `QueryClientProvider` est bien monté dans `main.tsx` côté prod. Je peux vérifier dans la même passe si tu le demandes.
- Activation d'AVIF côté `OptimizedImage` (Supabase supporte `format=avif`) : gain réel mais demande de valider la compat sur ton parc utilisateurs ; à traiter dans un lot séparé.
