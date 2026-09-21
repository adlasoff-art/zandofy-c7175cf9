import type { PurchaseScope } from "@/lib/discovery-prefs";

/**
 * Shop-type filter for catalogue fetches under discovery prefs.
 * city/country → prefer local; any_country / incomplete → open or HomeMarket filter.
 */
export function discoveryShopTypeFilter(
  hasCompleted: boolean,
  purchaseScope: PurchaseScope | null | undefined,
  homeShopTypeFilter: "local" | "international" | undefined,
): "local" | "international" | undefined {
  if (hasCompleted && (purchaseScope === "city" || purchaseScope === "country")) {
    return "local";
  }
  if (!hasCompleted) return homeShopTypeFilter;
  return undefined;
}

export function prefersLocalDiscoveryScope(
  hasCompleted: boolean,
  purchaseScope: PurchaseScope | null | undefined,
): boolean {
  return hasCompleted && (purchaseScope === "city" || purchaseScope === "country");
}

/** Merge primary (local) pool with optional open-market backfill, preserving order / uniqueness. */
export function mergeProductPools<T extends { id: string }>(primary: T[], backfill: T[]): T[] {
  const seen = new Set(primary.map((p) => p.id));
  const out = [...primary];
  for (const p of backfill) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

type ShopTypeOpt = "local" | "international" | undefined;

/**
 * Fetch preferring local shop_type; if pool &lt; minCount, second open-market request for backfill only.
 */
export async function fetchWithLocalFirstBackfill<T extends { id: string }>(
  fetchFn: (shopType: ShopTypeOpt) => Promise<T[]>,
  opts: {
    shopType: ShopTypeOpt;
    preferLocalBackfill: boolean;
    minCount: number;
  },
): Promise<T[]> {
  const primary = await fetchFn(opts.shopType);
  if (!opts.preferLocalBackfill || opts.shopType !== "local" || primary.length >= opts.minCount) {
    return primary;
  }
  const open = await fetchFn(undefined);
  return mergeProductPools(primary, open);
}
