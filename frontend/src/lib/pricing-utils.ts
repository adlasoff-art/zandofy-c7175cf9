/**
 * Pricing calculation utilities for vendor auto-pricing system.
 * All monetary values in USD (or base currency). Uses cents-safe rounding.
 */

export interface PricingTier {
  /** Cost ceiling (exclusive). null = no upper bound (catch-all top tier). */
  max_cost: number | null;
  multiplier: number;
}

export interface PricingDefaults {
  margin_pct: number;       // default 15
  multiplier: number;       // default 3
  max_extra_margin_under_50: number;  // default 0.50
  max_extra_margin_over_100: number;  // default 1.00
  transaction_fee_pct: number; // default 5
  /** Degressive multiplier tiers by cost_calc range. If absent, falls back to fixed `multiplier`. */
  tiers?: PricingTier[];
}

export const DEFAULT_TIERS: PricingTier[] = [
  { max_cost: 10, multiplier: 3.0 },
  { max_cost: 30, multiplier: 2.5 },
  { max_cost: 80, multiplier: 2.0 },
  { max_cost: 200, multiplier: 1.5 },
  { max_cost: null, multiplier: 1.3 },
];

export const DEFAULT_PRICING: PricingDefaults = {
  margin_pct: 15,
  multiplier: 3,
  max_extra_margin_under_50: 0.50,
  max_extra_margin_over_100: 1.00,
  transaction_fee_pct: 5,
  tiers: DEFAULT_TIERS,
};

/**
 * Strategic rounding: price ends in .99 or .49
 * e.g. 12.34 → 11.99, 25.70 → 25.49 or 24.99
 */
export function strategicRound(price: number): number {
  if (price <= 0) return 0;
  return Math.floor(price) + 0.99;
}

/**
 * Resolve the multiplier for a given cost. Priority order:
 * 1. explicit `forcedMultiplier` (e.g. vendor or category override)
 * 2. tier match against `tiers`
 * 3. fallback `defaultMultiplier`
 */
export function resolveMultiplier(
  costCalc: number,
  opts: {
    forcedMultiplier?: number | null;
    tiers?: PricingTier[] | null;
    defaultMultiplier?: number;
  } = {},
): number {
  if (opts.forcedMultiplier != null && opts.forcedMultiplier > 0) {
    return opts.forcedMultiplier;
  }
  const tiers = opts.tiers && opts.tiers.length > 0 ? opts.tiers : null;
  if (tiers) {
    // Sort ascending; null max_cost = catch-all top tier
    const sorted = [...tiers].sort((a, b) => {
      if (a.max_cost == null) return 1;
      if (b.max_cost == null) return -1;
      return a.max_cost - b.max_cost;
    });
    for (const t of sorted) {
      if (t.max_cost == null || costCalc < t.max_cost) return t.multiplier;
    }
  }
  return opts.defaultMultiplier ?? DEFAULT_PRICING.multiplier;
}

/**
 * Calculate sale price from cost_calc using the formula:
 * effectiveCost = costCalc + (costCalc × transactionFeePct / 100)
 * sale_price = effectiveCost + (effectiveCost × margin_pct / 100) × multiplier + vendorExtra
 */
export function calculateSalePrice(
  costCalc: number,
  marginPct: number = DEFAULT_PRICING.margin_pct,
  multiplier: number = DEFAULT_PRICING.multiplier,
  vendorExtra: number = 0,
  transactionFeePct: number = DEFAULT_PRICING.transaction_fee_pct,
): number {
  if (costCalc <= 0) return 0;
  const effectiveCost = costCalc + (costCalc * transactionFeePct / 100);
  const marginAmount = (effectiveCost * marginPct / 100) * multiplier;
  const raw = effectiveCost + marginAmount + vendorExtra;
  return strategicRound(raw);
}

/**
 * Calculate marketing old price (prix barré) based on sale price ranges.
 */
export function calculateOldPrice(salePrice: number): number {
  if (salePrice <= 0) return 0;
  let multiplier: number;
  if (salePrice < 10) multiplier = 3;
  else if (salePrice < 20) multiplier = 2.5;
  else if (salePrice < 50) multiplier = 2;
  else if (salePrice < 100) multiplier = 2;
  else if (salePrice < 150) multiplier = 1.8;
  else multiplier = 1.5;

  const raw = salePrice * multiplier;
  return strategicRound(raw);
}

/**
 * Get the maximum allowed vendor extra margin for a given sale price.
 */
export function getMaxExtraMargin(
  salePrice: number,
  settings: Pick<PricingDefaults, "max_extra_margin_under_50" | "max_extra_margin_over_100"> = DEFAULT_PRICING,
): number {
  if (salePrice >= 100) return settings.max_extra_margin_over_100;
  return settings.max_extra_margin_under_50;
}

/**
 * Calculate gross margin percentage: (salePrice - costReal) / salePrice * 100
 */
export function calculateMarginPercent(costReal: number, salePrice: number): number {
  if (salePrice <= 0 || costReal < 0) return 0;
  return Number(((salePrice - costReal) / salePrice * 100).toFixed(1));
}
