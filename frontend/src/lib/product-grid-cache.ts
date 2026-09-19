import type { Product } from "@/services/api";

const CACHE_KEY = "zandofy_home_product_grid_v4";
const TTL_MS = 30 * 60 * 1000;

export type ProductGridCache = {
  /** Market scope when cached — never restore across markets. */
  market: "all" | "local" | "international";
  products: Product[];
  moreProducts: Product[];
  popularProducts: Product[];
  categorySections: { label: string; products: Product[]; href: string }[];
  activeTab: string;
  hasMore: boolean;
  currentOffset: number;
  savedAt: number;
};

export function readProductGridCache(
  market: "all" | "local" | "international" = "all",
): ProductGridCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductGridCache;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) return null;
    if (!Array.isArray(parsed.products)) return null;
    // Only restore matching market (default legacy entries without market → treat as all)
    const cachedMarket = parsed.market || "all";
    if (cachedMarket !== market) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProductGridCache(
  data: Omit<ProductGridCache, "savedAt">,
) {
  try {
    // Never persist filtered market snapshots as the default "all" feed
    if (data.market !== "all") return;
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
