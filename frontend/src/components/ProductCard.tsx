import { Heart, ShoppingCart, Plus, Star, Trophy, Check, Award, GitCompareArrows } from "lucide-react";
import { useState, useCallback, useRef, memo } from "react";
import { useLazyImage } from "@/hooks/use-lazy-image";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCompare } from "@/contexts/CompareContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTrackProductClick } from "@/hooks/use-analytics";
import { CertificationBadge } from "@/components/CertificationBadge";
import { formatStoreYears } from "@/lib/store-years";
import type { Product } from "@/services/api";
import { buildImageSrcSet, optimizeImageUrl, PRODUCT_CARD_WIDTHS } from "@/utils/image-url";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export const ProductCard = memo(function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { ref, inView, loaded, onLoad } = useLazyImage(product.image);
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { t, formatPrice, locale } = useI18n();
  const { isInCompare, addToCompare, removeFromCompare } = useCompare();
  const trackProductClick = useTrackProductClick();
  const wishlisted = isInWishlist(product.id);
  const compared = isInCompare(product.id);
  const [cartSuccess, setCartSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout>>();

  // Second image from gallery (first variant/additional image)
  const galleryImages = (product as any).galleryImages as Array<{ image_url: string; position: number | null }> | undefined;
  const secondImage = galleryImages && galleryImages.length > 1
    ? galleryImages.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[1]?.image_url
    : null;
  const rawDisplayImage = hovered && secondImage ? secondImage : (imgError ? "/placeholder.svg" : product.image);
  const displayImage = optimizeImageUrl(rawDisplayImage, 400);
  const displaySrcSet = buildImageSrcSet(rawDisplayImage, PRODUCT_CARD_WIDTHS);
  const cardSizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw";

  // Determine first available variant defaults
  const firstColor = product.colors?.[0] ?? null;
  const firstSize = product.sizes?.[0] ?? null;

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
  }, [addItem, product, cartSuccess]);

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
      ref={ref}
      className="group relative bg-card overflow-hidden rounded-sm shadow-card hover:shadow-card-hover transition-shadow duration-200 ease-in-out border border-border/40 flex flex-col h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => trackProductClick(product.id, "card")}
    >
      {/* Image — fixed aspect ratio, object-contain to avoid blur */}
      <div className="relative aspect-[3/4] overflow-hidden bg-muted shrink-0">
        {!loaded && inView && (
          <div className="absolute inset-0 skeleton-shimmer" />
        )}
        {inView && (
          <>
            <img
              src={displayImage}
              srcSet={displaySrcSet}
              sizes={cardSizes}
              alt={product.nameFr}
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ease-out ${
                loaded ? "opacity-100" : "opacity-0"
              } ${hovered && secondImage ? "opacity-0 scale-105" : ""}`}
              loading={index < 6 ? "eager" : "lazy"}
              {...(index < 2 ? ({ fetchpriority: "high" } as React.HTMLAttributes<HTMLImageElement>) : {})}
              onLoad={onLoad}
              onError={handleImgError}
            />
            {secondImage && (
              <img
                src={optimizeImageUrl(secondImage, 400)}
                srcSet={buildImageSrcSet(secondImage, PRODUCT_CARD_WIDTHS)}
                sizes={cardSizes}
                alt={product.nameFr}
                decoding="async"
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ease-out ${
                  hovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
                }`}
                loading="lazy"
              />
            )}
          </>
        )}

        {/* Discount badge - top left */}
        {product.isSale && product.discount && (
          <span className="absolute top-0 left-0 px-2 py-1 text-xs font-bold bg-sale text-sale-foreground">
            -{product.discount}%
          </span>
        )}

        {/* Top seller badge - bottom left */}
        {(product as any).sellerRank && (product as any).sellerRank <= 10 && (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/90 text-white rounded-sm backdrop-blur-sm">
            <Award size={9} />
            #{(product as any).sellerRank}
          </span>
        )}

        {/* Wishlist button - top right — always visible on touch */}
        <button
          onClick={handleWishlist}
          className={`absolute top-2 right-2 w-9 h-9 bg-card/80 dark:bg-card rounded-full flex items-center justify-center touch-manipulation active-press ${
            wishlisted ? "opacity-100 scale-110" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          }`}
          aria-label={wishlisted ? "Retirer des favoris" : "Ajouter aux favoris"}
          style={{ WebkitTapHighlightColor: "transparent", transition: "opacity 0.2s, transform 0.2s" }}
        >
          <Heart size={14} className={wishlisted ? "fill-sale text-sale" : "text-foreground dark:text-primary/80"} />
        </button>

        {/* Compare button - below wishlist */}
        <button
          onClick={handleCompare}
          className={`absolute top-12 right-2 w-9 h-9 bg-card/80 dark:bg-card rounded-full flex items-center justify-center touch-manipulation active-press ${
            compared ? "opacity-100 bg-primary/20" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          }`}
          aria-label={compared ? "Retirer du comparateur" : "Comparer"}
          style={{ WebkitTapHighlightColor: "transparent", transition: "opacity 0.2s, transform 0.2s" }}
        >
          <GitCompareArrows size={14} className={compared ? "text-primary" : "text-foreground dark:text-primary/80"} />
        </button>
      </div>

      {/* Product info — flex column to push footer down */}
      <div className="p-2 flex flex-col flex-1">
        {/* Title — fixed 2-line height */}
        <h3 className="text-xs text-foreground line-clamp-2 leading-relaxed min-h-[2.5rem]">
          {locale === "fr" ? product.nameFr : product.name}
        </h3>

        {/* Psychological pricing */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-foreground dark:text-primary font-bold text-base">
            {formatPrice(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-[11px] text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
          {product.isSale && product.discount && (
            <span className="text-[11px] font-bold text-sale bg-sale/10 px-1 py-0.5 rounded">
              -{product.discount}%
            </span>
          )}
        </div>

        {/* Badges row: seniority + MOQ + origin */}
        <div className="flex items-center gap-2 flex-wrap min-h-[1.25rem] mt-1">
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

        {/* Local stock badge */}
        {(product as any).shopType === "local" && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded mt-0.5">
            🏪 En stock · Livraison rapide
          </span>
        )}

        {/* Rating + Reviews */}
        <div className="min-h-[1rem] flex items-center gap-1 mt-1">
          <Star size={10} className="fill-accent text-accent shrink-0" />
          <span className="text-[10px] text-muted-foreground">{product.rating > 0 ? product.rating : "—"}</span>
          <span className="text-[10px] text-muted-foreground">| {(product as any).salesCount ?? product.reviewCount} {t("product.sold")}</span>
        </div>

        {/* Certification badge — only if store is certified */}
        {(product as any).storeIsCertified && (
          <div className="mt-1 flex items-center gap-1">
            <CertificationBadge type="vendor" variant="icon-only" />
          </div>
        )}

        {/* Color swatches — small dots showing available colors */}
        {product.colors && product.colors.length > 1 && (
          <div className="flex items-center gap-0.5 mt-1 flex-wrap">
            {product.colors.slice(0, 6).map((color, idx) => (
              <span
                key={idx}
                className="w-2.5 h-2.5 rounded-full border border-border/60 shrink-0"
                style={{ backgroundColor: color.toLowerCase() }}
                title={color}
              />
            ))}
            {product.colors.length > 6 && (
              <span className="text-[8px] text-muted-foreground ml-0.5">+{product.colors.length - 6}</span>
            )}
          </div>
        )}

        {/* Spacer pushes footer to bottom */}
        <div className="flex-1" />

        {/* Add to cart row — always at bottom */}
        <div className="flex items-center justify-end pt-1">
          <button
            onClick={handleAddToCart}
            className={`action-button min-w-[52px] h-11 px-[17px] rounded-full border-2 flex items-center justify-center gap-0.5 transition-all duration-75 active-press touch-manipulation ${
              cartSuccess
                ? "border-primary bg-primary text-primary-foreground scale-105"
                : "border-primary bg-transparent text-primary"
            }`}
            aria-label={t("product.addToCart")}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {cartSuccess ? (
              <Check size={16} strokeWidth={3} className="animate-in zoom-in-50 duration-150" />
            ) : (
              <>
                <ShoppingCart size={14} strokeWidth={2.5} />
                <Plus size={10} strokeWidth={3} />
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
      <div className="aspect-[3/4] skeleton-shimmer" />
      <div className="p-2 space-y-1.5">
        <div className="h-3 w-full skeleton-shimmer rounded" />
        <div className="h-3 w-3/4 skeleton-shimmer rounded" />
        <div className="h-4 w-16 skeleton-shimmer rounded" />
        <div className="h-3 w-20 skeleton-shimmer rounded" />
      </div>
    </div>
  );
}
