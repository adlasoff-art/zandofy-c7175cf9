import type { ReactNode } from "react";
import { Award, Check, Copy, Share2, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Product } from "@/services/api";
import { getIncentiveTier } from "@/lib/product-pdp";
import type { PricingTier } from "@/components/TieredPricingTable";

type Props = {
  product: Product;
  productSku: string;
  copied: boolean;
  onCopySku: () => void;
  currentUnitPrice: number;
  basePrice: number;
  pricingTiers: PricingTier[];
  formatPrice: (n: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  shareContent: ReactNode;
  sellerRank?: number;
};

function PriceDisplay({ value, formatPrice }: { value: number; formatPrice: (n: number) => string }) {
  const formatted = formatPrice(value);
  const match = formatted.match(/^([^\d]*)([\d,]+)([.,](\d{2}))?/);
  if (!match) {
    return <span className="text-3xl font-bold text-foreground leading-none">{formatted}</span>;
  }
  const whole = match[2]?.replace(/,/g, "") ?? String(Math.floor(value));
  const dec = match[4] ?? (value % 1).toFixed(2).slice(2);
  const prefix = formatted.charAt(0) === "$" || formatted.includes("$") ? "$" : "";
  return (
    <span className="text-foreground font-bold flex items-baseline">
      {prefix && <span className="text-sm">{prefix}</span>}
      <span className="text-3xl leading-none">{whole}</span>
      <span className="text-sm">.{dec}</span>
    </span>
  );
}

export function ProductBuyColumn({
  product,
  productSku,
  copied,
  onCopySku,
  currentUnitPrice,
  basePrice,
  pricingTiers,
  formatPrice,
  t,
  shareContent,
  sellerRank,
}: Props) {
  const incentive = getIncentiveTier(pricingTiers, basePrice);

  return (
    <div className="space-y-3">
      <h1 className="hidden lg:block text-lg md:text-xl font-semibold text-foreground leading-tight line-clamp-3">
        {product.nameFr}
      </h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="inline-flex items-center gap-1 text-foreground">
          <Star size={14} className="fill-accent text-accent shrink-0" />
          <span className="font-medium">{product.rating}</span>
        </span>
        <span className="text-muted-foreground">
          {product.reviewCount > 0
            ? t("product.reviewsCount", { count: product.reviewCount.toLocaleString() })
            : t("product.noReviews")}
        </span>
        {(product.salesCount ?? 0) > 0 && (
          <span className="text-muted-foreground">
            {product.salesCount!.toLocaleString()} {t("product.sold")}
          </span>
        )}
        {sellerRank != null && sellerRank <= 10 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--badge-bestseller))] border border-[hsl(var(--badge-bestseller-border))] text-[hsl(var(--badge-bestseller-foreground))] text-xs font-semibold">
            <Award size={12} className="text-[hsl(var(--badge-bestseller-icon))]" />
            {t("product.bestSupplierIn", { rank: sellerRank, category: product.categoryFr })}
          </span>
        )}
      </div>

      {product.shortDescription && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
          {product.shortDescription}
        </p>
      )}

      <Separator className="bg-border/50" />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          {productSku}
          <button
            type="button"
            onClick={onCopySku}
            className="text-primary hover:text-primary/80 transition-colors"
            aria-label={t("product.copySkuAria") || "Copier le SKU"}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("product.shareAria") || "Partager"}
            >
              <Share2 size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            {shareContent}
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <PriceDisplay value={currentUnitPrice} formatPrice={formatPrice} />
          {currentUnitPrice < basePrice && (
            <p className="text-sm text-muted-foreground line-through mt-0.5">{formatPrice(basePrice)}</p>
          )}
        </div>
        {incentive && (
          <div className="text-left">
            <p className="text-xl font-bold text-primary leading-none">{formatPrice(incentive.unitPrice)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("product.incentiveTierRange", { range: incentive.rangeLabel })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
