/**
 * Pricing calculation utilities for vendor auto-pricing system.
 * All monetary values in USD (or base currency). Uses cents-safe rounding.
 */

export interface PricingDefaults {
  margin_pct: number;       // default 15
  multiplier: number;       // default 3
  max_extra_margin_under_50: number;  // default 0.50
  max_extra_margin_over_100: number;  // default 1.00
}

export const DEFAULT_PRICING: PricingDefaults = {
  margin_pct: 15,
  multiplier: 3,
  max_extra_margin_under_50: 0.50,
  max_extra_margin_over_100: 1.00,
};

/**
 * Strategic rounding: price ends in .99 or .49
 * e.g. 12.34 → 11.99, 25.70 → 25.49 or 24.99
 */
export function strategicRound(price: number): number {
  if (price <= 0) return 0;
  const floor = Math.floor(price);
  const decimal = price - floor;
  // If we're above .50, round to floor.99
  // If we're above .00, round to (floor-1).99 or floor.49
  if (decimal >= 0.50) {
    return floor + 0.99;
  }
  if (decimal >= 0.25) {
    return floor + 0.49;
  }
  // Below 0.25 → (floor - 1).99 but keep minimum
  return floor > 0 ? (floor - 1) + 0.99 : 0.99;
}

/**
 * Calculate sale price from cost_calc using the formula:
 * sale_price = cost_calc + (cost_calc × margin_pct / 100) × multiplier + vendorExtra
 */
export function calculateSalePrice(
  costCalc: number,
  marginPct: number = DEFAULT_PRICING.margin_pct,
  multiplier: number = DEFAULT_PRICING.multiplier,
  vendorExtra: number = 0,
): number {
  if (costCalc <= 0) return 0;
  const marginAmount = (costCalc * marginPct / 100) * multiplier;
  const raw = costCalc + marginAmount + vendorExtra;
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
  if (salePrice < 50) return settings.max_extra_margin_under_50;
  // Between 50 and 100: interpolate linearly
  const ratio = (salePrice - 50) / 50;
  return Number((settings.max_extra_margin_under_50 + ratio * (settings.max_extra_margin_over_100 - settings.max_extra_margin_under_50)).toFixed(2));
}

/**
 * Calculate gross margin percentage: (salePrice - costReal) / salePrice * 100
 */
export function calculateMarginPercent(costReal: number, salePrice: number): number {
  if (salePrice <= 0 || costReal < 0) return 0;
  return Number(((salePrice - costReal) / salePrice * 100).toFixed(1));
}
