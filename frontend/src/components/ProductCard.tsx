import { Heart, ShoppingCart, Plus, Star, Trophy, Check, Award, GitCompareArrows } from "lucide-react";
import { useState, useCallback, useRef, memo } from "react";
import { useCart } from "@/contexts/CartContext";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCompare } from "@/contexts/CompareContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTrackProductClick } from "@/hooks/use-analytics";
import { CertificationBadge } from "@/components/CertificationBadge";
import { formatStoreYears } from "@/lib/store-years";
import type { Product } from "@/services/api";
import { PRODUCT_CARD_IMAGE_CLASS, PRODUCT_CARD_IMAGE_HOVER_CLASS } from "@/lib/product-image-fit";

interface ProductCardProps {
  product: Product;
  index?: number;
  /** Mark this card as LCP-priority (eager + fetchpriority=high). */
  priority?: boolean;
}

export const ProductCard = memo(function ProductCard({ product, index = 0, priority = false }: ProductCardProps) {
  const [loaded, setLoaded] = useState(false);
  const onLoad = useCallback(() => setLoaded(true), []);
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { t, formatPrice, locale } = useI18n();
  const { isInCompare, addToCompare, removeFromCompare } = useCompare();
  const trackProductClick = useTrackProductClick();
  const wishlisted = isInWishlist(product.id);
  const compared = isInCompare(product.id);
  const [cartSuccess, setCartSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout>>();

  const galleryImages = (product as any).galleryImages as Array<{ image_url: string; position: number | null }> | undefined;
  const secondImage = galleryImages && galleryImages.length > 1
    ? galleryImages.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[1]?.image_url
    : null;
  const firstColor = product.colors?.[0] ?? null;
  const firstSize = product.sizes?.[0] ?? null;
  const showColors = (product.colors?.length ?? 0) > 0;
  const displayPrice = product.flashPrice ?? product.price;
  const hasFlashPrice =
    product.flashPrice != null && Number.isFinite(product.flashPrice) && product.flashPrice < product.price;

  const handleAddToCart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartSuccess) return;
    addItem({
      productId: product.id,
      name: product.name,
      nameFr: product.nameFr,
      image: product.image,
      price: product.price,
      originalPrice: product.originalPrice,
      color: firstColor,
      size: firstSize,
      quantity: product.moq || 1,
      moq: product.moq || 1,
    });
    setCartSuccess(true);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setCartSuccess(false), 1200);
  }, [addItem, product, cartSuccess, firstColor, firstSize]);

  const handleWishlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  }, [toggleWishlist, product.id]);

  const handleImgError = useCallback(() => setImgError(true), []);

  const handleCompare = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (compared) removeFromCompare(product.id);
    else addToCompare(product);
  }, [compared, product, addToCompare, removeFromCompare]);

  return (
    <div
      className="group relative bg-card overflow-hidden rounded-sm shadow-card hover:shadow-card-hover transition-shadow duration-200 ease-in-out border border-border/40 flex flex-col h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => trackProductClick(product.id, "card")}
    >
      {/* Image carrée — bord supérieur flush, ~40–45 % hauteur carte */}
      <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-t-sm bg-muted">
        {!loaded && <div className="absolute inset-0 skeleton-shimmer" />}
        <OptimizedImage
          src={imgError ? "/placeholder.svg" : product.image}
          alt={product.nameFr}
          className={`${PRODUCT_CARD_IMAGE_CLASS} ${loaded ? "opacity-100" : "opacity-0"} ${
            hovered && secondImage ? "opacity-0" : ""
          }`}
          onLoad={onLoad}
          onError={handleImgError}
          widths={[160, 240, 360]}
          sizes="(max-width: 640px) 50vw, 170px"
          quality={75}
          resize="contain"
          fitHeight={360}
          priority={priority || index < 2}
        />
        {secondImage && hovered && (
          <OptimizedImage
            src={secondImage}
            alt={product.nameFr}
            className={PRODUCT_CARD_IMAGE_HOVER_CLASS}
            widths={[160, 240, 360]}
            sizes="(max-width: 640px) 50vw, 170px"
            quality={75}
            resize="contain"
            fitHeight={360}
          />
        )}

        {product.isSale && product.discount && (
          <span className="absolute top-1 left-1 z-10 px-2 py-0.5 text-xs font-bold bg-sale text-sale-foreground rounded-sm">
            -{product.discount}%
          </span>
        )}

        {(product as any).sellerRank && (product as any).sellerRank <= 10 && (
          <span className="absolute bottom-1 left-1 z-10 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/90 text-white rounded-sm backdrop-blur-sm">
            <Award size={9} />
            #{(product as any).sellerRank}
          </span>
        )}

        <button
          type="button"
          onClick={handleWishlist}
          className={`absolute top-1.5 right-1.5 z-10 w-8 h-8 bg-card/80 dark:bg-card rounded-full flex items-center justify-center touch-manipulation active-press ${
            wishlisted ? "opacity-100 scale-110" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          }`}
          aria-label={wishlisted ? "Retirer des favoris" : "Ajouter aux favoris"}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Heart size={14} className={wishlisted ? "fill-sale text-sale" : "text-foreground dark:text-primary/80"} />
        </button>

        <button
          type="button"
          onClick={handleCompare}
          className={`absolute top-10 right-1.5 z-10 w-8 h-8 bg-card/80 dark:bg-card rounded-full flex items-center justify-center touch-manipulation active-press ${
            compared ? "opacity-100 bg-primary/20" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          }`}
          aria-label={compared ? "Retirer du comparateur" : "Comparer"}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <GitCompareArrows size={14} className={compared ? "text-primary" : "text-foreground dark:text-primary/80"} />
        </button>
      </div>

      {/* Contenu texte — compact */}
      <div className="px-2 pt-1.5 pb-2 flex flex-col flex-1 min-h-0">
        <h3 className="text-xs text-foreground line-clamp-2 leading-snug min-h-[2.25rem]">
          {locale === "fr" ? product.nameFr : product.name}
        </h3>

        <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
          <span className="text-foreground dark:text-primary font-bold text-sm">
            {formatPrice(displayPrice)}
          </span>
          {(hasFlashPrice || product.originalPrice) && (
            <span className="text-[11px] text-muted-foreground line-through">
              {formatPrice(hasFlashPrice ? product.price : product.originalPrice!)}
            </span>
          )}
          {product.isSale && product.discount && (
            <span className="text-[10px] font-bold text-sale bg-sale/10 px-1 py-0.5 rounded">
              -{product.discount}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-certified bg-certified/10 px-1.5 py-0.5 rounded">
            <Trophy size={9} strokeWidth={2.5} />
            {formatStoreYears(product.verifiedYears ?? 0)}
          </span>
          {product.moq && product.moq > 1 && (
            <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              MOQ: {product.moq}
            </span>
          )}
          {product.originCountry && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              <span className="w-2 h-2 rounded-full bg-sale inline-block" />
              {product.originCountry}
            </span>
          )}
        </div>

        {(product as any).shopType === "local" && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded mt-0.5 w-fit">
            🏪 En stock · Livraison rapide
          </span>
        )}

        <div className="flex items-center gap-1 mt-0.5 min-h-[1rem]">
          <Star size={10} className="fill-accent text-accent shrink-0" />
          <span className="text-[10px] text-muted-foreground">{product.rating > 0 ? product.rating : "—"}</span>
          <span className="text-[10px] text-muted-foreground">
            | {(product as any).salesCount ?? product.reviewCount} {t("product.sold")}
          </span>
        </div>

        {(product as any).storeIsCertified && (
          <div className="mt-0.5 flex items-center gap-1">
            <CertificationBadge type="vendor" variant="icon-only" />
          </div>
        )}

        {/* Pied : couleurs + panier sur la même ligne */}
        <div className="flex items-center justify-between gap-2 mt-1.5 min-h-[2.25rem]">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {showColors ? (
              <>
                {product.colors!.slice(0, 6).map((color, idx) =>
                  color ? (
                    <span
                      key={idx}
                      className="w-3 h-3 rounded-full border border-border/60 shrink-0"
                      style={{ backgroundColor: String(color).toLowerCase() }}
                      title={color}
                    />
                  ) : null,
                )}
                {product.colors!.length > 6 && (
                  <span className="text-[8px] text-muted-foreground">+{product.colors!.length - 6}</span>
                )}
              </>
            ) : (
              <span className="w-3 h-3 rounded-full border border-border/40 bg-muted shrink-0" aria-hidden />
            )}
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className={`action-button shrink-0 min-w-[44px] h-9 px-3 rounded-full border-2 flex items-center justify-center gap-0.5 transition-all duration-75 active-press touch-manipulation ${
              cartSuccess
                ? "border-primary bg-primary text-primary-foreground scale-105"
                : "border-primary bg-transparent text-primary"
            }`}
            aria-label={t("product.addToCart")}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {cartSuccess ? (
              <Check size={15} strokeWidth={3} className="animate-in zoom-in-50 duration-150" />
            ) : (
              <>
                <ShoppingCart size={13} strokeWidth={2.5} />
                <Plus size={9} strokeWidth={3} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export function ProductCardSkeleton() {
  return (
    <div className="bg-card overflow-hidden rounded-sm border border-border/40 flex flex-col h-full">
      <div className="aspect-square w-full skeleton-shimmer rounded-t-sm" />
      <div className="px-2 py-2 space-y-1.5 flex-1 flex flex-col">
        <div className="h-3 w-full skeleton-shimmer rounded" />
        <div className="h-3 w-3/4 skeleton-shimmer rounded" />
        <div className="h-3.5 w-16 skeleton-shimmer rounded" />
        <div className="flex justify-between items-center mt-auto pt-1">
          <div className="h-3 w-12 skeleton-shimmer rounded" />
          <div className="h-9 w-9 skeleton-shimmer rounded-full" />
        </div>
      </div>
    </div>
  );
}
