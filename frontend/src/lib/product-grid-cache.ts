import type { Product } from "@/services/api";

const CACHE_KEY = "zandofy_home_product_grid_v1";
const TTL_MS = 30 * 60 * 1000;

export type ProductGridCache = {
  products: Product[];
  moreProducts: Product[];
  popularProducts: Product[];
  categorySections: { label: string; products: Product[]; href: string }[];
  activeTab: string;
  hasMore: boolean;
  currentOffset: number;
  savedAt: number;
};

export function readProductGridCache(): ProductGridCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductGridCache;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) return null;
    if (!Array.isArray(parsed.products)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProductGridCache(data: Omit<ProductGridCache, "savedAt">) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() } satisfies ProductGridCache),
    );
  } catch {
    /* quota */
  }
}

export function clearProductGridCache() {
  sessionStorage.removeItem(CACHE_KEY);
}
