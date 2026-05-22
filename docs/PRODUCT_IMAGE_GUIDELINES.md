# Guidelines — images produits (homepage & grilles)

Référence visuelle : **Top Tendances** (`ProductCard`, zone image **carrée** flush en haut).

## Principe d'affichage

- **Grilles produit** (`ProductCard`) : `aspect-square` flush en haut (`rounded-t-sm`) + `object-contain` + `resize=contain` CDN — produit entier visible, `scale-105` au survol + 2ᵉ image galerie si disponible.
- **Catégories rondes** : `object-contain` + `resize=contain` (jamais `cover` sur les cercles).
- **Pour vous** : carré `object-cover` via `imgUrl` (inchangé).

## Formats par zone

| Zone | Ratio affiché | Taille source recommandée | Notes |
|------|---------------|---------------------------|--------|
| Grilles générales (Top Tendances, catégories, Voir plus) | **1:1** (carré, ~40–45 % hauteur carte) | **800 × 800 px** (min. 600 × 600) | Centrer le produit ; fond uni ou transparent OK |
| Super Promo (carrousel, ~8 cartes visibles desktop) | **1:1** | **800 × 800 px** | Largeur slot `calc((100%-3.5rem)/8)` sur md+ |
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
