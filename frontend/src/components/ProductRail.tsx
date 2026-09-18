import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import type { Product } from "@/services/api";
import { PRODUCT_GRID_CLASS } from "@/lib/product-image-fit";
import { cn } from "@/lib/utils";
import { sanitizeRouterTo } from "@/lib/safe-href";

/** ~2 cards visible on phone; denser on tablet. */
export const PRODUCT_RAIL_SLOT_CLASS =
  "snap-start shrink-0 w-[42vw] max-w-[180px] min-w-[140px] sm:w-[160px] sm:min-w-[160px]";

type ProductRailProps = {
  title: string;
  titleId?: string;
  seeAllHref?: string;
  products: Product[];
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  /** Desktop: keep grid (default). Set false to always use horizontal rail. */
  gridOnDesktop?: boolean;
  skeletonCount?: number;
  /** Skip outer section/container when already inside a parent container. */
  embedded?: boolean;
};

export function ProductRail({
  title,
  titleId,
  seeAllHref,
  products,
  loading = false,
  icon,
  className,
  gridOnDesktop = true,
  skeletonCount = 8,
  embedded = false,
}: ProductRailProps) {
  const safeSeeAll = sanitizeRouterTo(seeAllHref) || undefined;

  const heading = (
    <div className="flex items-center gap-2 mb-4 group">
      {icon}
      <h2
        id={titleId}
        className="text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors"
      >
        {title}
      </h2>
      {safeSeeAll && (
        <ChevronRight
          size={16}
          className="text-muted-foreground group-hover:text-primary transition-colors"
        />
      )}
    </div>
  );

  const rail = (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory touch-pan-x lg:hidden">
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className={PRODUCT_RAIL_SLOT_CLASS}>
              <ProductCardSkeleton />
            </div>
          ))
        : products.map((product, i) => (
            <div key={product.id} className={PRODUCT_RAIL_SLOT_CLASS}>
              <Link to={`/product/${product.slug || product.id}`} className="block">
                <ProductCard product={product} index={i} />
              </Link>
            </div>
          ))}
    </div>
  );

  const grid = gridOnDesktop ? (
    <div className={cn(PRODUCT_GRID_CLASS, "hidden lg:grid")}>
      {loading
        ? Array.from({ length: Math.min(skeletonCount, 12) }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))
        : products.map((product, i) => (
            <Link
              to={`/product/${product.slug || product.id}`}
              key={product.id}
              className="block"
            >
              <ProductCard product={product} index={i} />
            </Link>
          ))}
    </div>
  ) : null;

  const alwaysRail = !gridOnDesktop ? (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory touch-pan-x">
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className={PRODUCT_RAIL_SLOT_CLASS}>
              <ProductCardSkeleton />
            </div>
          ))
        : products.map((product, i) => (
            <div key={product.id} className={PRODUCT_RAIL_SLOT_CLASS}>
              <Link to={`/product/${product.slug || product.id}`} className="block">
                <ProductCard product={product} index={i} />
              </Link>
            </div>
          ))}
    </div>
  ) : null;

  const body = (
    <>
      {safeSeeAll ? (
        <Link to={safeSeeAll} className="w-fit cursor-pointer block">
          {heading}
        </Link>
      ) : (
        heading
      )}
      {gridOnDesktop ? (
        <>
          {rail}
          {grid}
        </>
      ) : (
        alwaysRail
      )}
    </>
  );

  if (embedded) {
    return (
      <div className={className} aria-labelledby={titleId}>
        {body}
      </div>
    );
  }

  return (
    <section className={cn("py-4", className)} aria-labelledby={titleId}>
      <div className="container">{body}</div>
    </section>
  );
}
