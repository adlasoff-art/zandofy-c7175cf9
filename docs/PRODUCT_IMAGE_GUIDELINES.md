# Guidelines — images produits (homepage & grilles)

Référence visuelle : **Top Tendances** (`ProductCard`, ratio **3:4**).

## Principe d'affichage

- Le cadre est rempli avec `object-cover` + `object-center` (pas de bandes vides).
- Pas de zoom hover agressif sur les grilles.
- Côté Supabase Storage, les vignettes utilisent `resize=cover` (voir `OptimizedImage`, `imgUrl`).

## Formats par zone

| Zone | Ratio affiché | Taille source recommandée | Notes |
|------|---------------|---------------------------|--------|
| Grilles générales (Top Tendances, catégories, Voir plus, Super Promo) | **3:4** (portrait) | **900 × 1200 px** (min. 600 × 800) | Centrer le produit dans le cadre ; fond uni ou transparent OK |
| Super Promo (carrousel étroit) | **3:4** (carte ~170×227 px) | **680 × 900 px** | Même ratio, fichier un peu plus léger acceptable |
| Pour vous | **1:1** (carré) | **800 × 800 px** | Produit centré, marges minimales |
| Fiche produit — galerie | **3:4** | **1200 × 1600 px** | Image principale nette ; variantes motif : carré ou 3:4 |

## Fichiers

- Format : **WebP** ou **JPEG** (qualité 80–85 %).
- Éviter les PNG très lourds sauf fond transparent nécessaire.
- Une image par variante couleur (`product_colors.image_url`) si motif différent.

## Super Promo — règle des 7 jours

- Les produits **sans** `promo_start_date` restent visibles dans Super Promo (promos catalogue existantes).
- Le compteur **7 jours** ne s'applique que si `promo_start_date` est renseigné.
- Les produits sélectionnés dans **flash_sales** (admin) restent affichés jusqu'à `ends_at`, indépendamment de cette règle.

## Admin

- Sélection Super Promo : table **flash_sales** (déjà gérée côté admin / flash sales).
- Pour faire démarrer le délai de 7 jours sur un produit `is_sale` : définir `promo_start_date` à la date de mise en avant.
