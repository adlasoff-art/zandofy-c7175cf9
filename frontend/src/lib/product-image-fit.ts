/**
 * Grille produit — style vignette Alibaba : cadre arrondi, produit entier visible,
 * léger zoom au survol desktop uniquement (pas de crop CDN agressif).
 */
export const PRODUCT_CARD_IMAGE_CLASS =
  "absolute inset-0 w-full h-full object-contain object-center transition-all duration-300 ease-out md:group-hover:scale-[1.03]";

export const PRODUCT_CARD_IMAGE_HOVER_CLASS =
  "absolute inset-0 w-full h-full object-contain object-center transition-all duration-300 ease-out opacity-100 md:group-hover:scale-[1.03]";

/** Icônes catégories rondes — contain, pas de crop cover. */
export const CATEGORY_ICON_IMAGE_CLASS = "w-full h-full object-contain object-center p-1";
