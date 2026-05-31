import type { Product } from "@/services/api";
import type { PricingTier } from "@/components/TieredPricingTable";

export interface GalleryItem {
  url: string;
  type: "image" | "video";
}

export interface ColorOption {
  hex: string;
  name: string;
  imageUrl: string | null;
}

export const PDP_THUMB_WIDTHS = [120, 160, 240] as const;
export const PDP_MAIN_WIDTHS = [600, 900, 1200] as const;
export const SWIPE_THRESHOLD_PX = 50;

export const SIZE_REGIONS: Record<string, string[]> = {
  EU: ["XS", "S", "M", "L", "XL", "XXL"],
  FR: ["34", "36", "38", "40", "42", "44"],
  US: ["0", "2", "4", "6", "8", "10"],
  UK: ["4", "6", "8", "10", "12", "14"],
  JP: ["5", "7", "9", "11", "13", "15"],
};

/** Tailles vêtement PDP : uniquement celles enregistrées par le vendeur (product_sizes), jamais SIZE_REGIONS par défaut. */
export function getApparelSizesForPdp(product: Product | undefined): string[] {
  const labels = product?.sizes?.filter((s): s is string => Boolean(s?.trim())) ?? [];
  return [...new Set(labels)];
}

export function getGalleryItems(product: Product): GalleryItem[] {
  const images = (product as { galleryImages?: Array<{ image_url: string; position: number | null }> })
    .galleryImages;
  if (images && images.length > 0) {
    return images
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((img) => ({
        url: img.image_url,
        type: img.image_url.match(/\.(mp4|webm|mov)$/i) ? ("video" as const) : ("image" as const),
      }));
  }
  return [{ url: product.image, type: "image" as const }];
}

export function resolveColorDisplayMode(colors: ColorOption[]): "image" | "swatch" {
  return colors.some((c) => Boolean(c.imageUrl?.trim())) ? "image" : "swatch";
}

function tierUnitPrice(basePrice: number, tier: PricingTier): number {
  if (tier.discountType === "percentage") {
    return basePrice * (1 - tier.discountValue / 100);
  }
  return Math.max(0, basePrice - tier.discountValue);
}

/** Second wholesale tier for Alibaba-style price incentive (first tier with minQuantity > 1, or index 1). */
export function getIncentiveTier(
  tiers: PricingTier[],
  basePrice: number,
): { tier: PricingTier; unitPrice: number; rangeLabel: string } | null {
  if (tiers.length < 2) return null;
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const incentive =
    sorted.find((t, i) => i > 0 && t.minQuantity > 1) ?? sorted[1];
  if (!incentive) return null;

  const idx = sorted.indexOf(incentive);
  const next = sorted[idx + 1];
  const rangeLabel = next
    ? `${incentive.minQuantity} - ${next.minQuantity - 1} pcs`
    : `${incentive.minQuantity}+ pcs`;

  return {
    tier: incentive,
    unitPrice: tierUnitPrice(basePrice, incentive),
    rangeLabel,
  };
}

export function buildColorOptions(
  product: Product,
  colorFallback: (index: number) => string,
): ColorOption[] {
  if (product.productColors?.length) {
    return product.productColors.filter((c) => Boolean(c.hex));
  }
  return (product.colors || [])
    .filter((hex): hex is string => Boolean(hex))
    .map((hex, i) => ({
      hex,
      name: colorFallback(i + 1),
      imageUrl: null as string | null,
    }));
}

export function collectVariantLightboxUrls(
  colorOptions: ColorOption[],
  gallery: GalleryItem[],
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const c of colorOptions) {
    if (c.imageUrl && !seen.has(c.imageUrl)) {
      seen.add(c.imageUrl);
      urls.push(c.imageUrl);
    }
  }
  for (const g of gallery) {
    if (g.type === "image" && !seen.has(g.url)) {
      seen.add(g.url);
      urls.push(g.url);
    }
  }
  return urls;
}

export function storeYearsLabel(store: {
  verified_years?: number | null;
  verified_years_override?: number | null;
  created_at?: string | null;
}): string | null {
  const years = store.verified_years_override ?? store.verified_years;
  if (years != null && years > 0) return `${years} ans`;
  if (store.created_at) {
    const y = Math.max(
      1,
      Math.floor((Date.now() - new Date(store.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
    );
    return `${y} ans`;
  }
  return null;
}
