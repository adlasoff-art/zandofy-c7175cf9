/**
 * Grille produit — image carrée flush en haut, produit entier visible (contain),
 * zoom léger au survol + 2ᵉ image si disponible.
 */
export const PRODUCT_CARD_IMAGE_CLASS =
  "absolute inset-0 w-full h-full object-contain object-center transition-transform duration-300 ease-out group-hover:scale-105";

export const PRODUCT_CARD_IMAGE_HOVER_CLASS =
  "absolute inset-0 w-full h-full object-contain object-center transition-transform duration-300 ease-out opacity-100 group-hover:scale-105";

/** Icônes catégories rondes — contain, pas de crop cover. */
export const CATEGORY_ICON_IMAGE_CLASS = "w-full h-full object-contain object-center p-1";

/** Grilles catalogue (hors « Pour vous ») : 6 colonnes desktop. */
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2";

/** Super Promo carrousel : ~8 cartes visibles sur desktop. */
export const SUPER_PROMO_CARD_SLOT_CLASS =
  "snap-start shrink-0 w-[148px] min-w-[148px] sm:w-[155px] sm:min-w-[155px] md:w-[calc((100%-3.5rem)/8)] md:min-w-[calc((100%-3.5rem)/8)] md:max-w-[200px]";
