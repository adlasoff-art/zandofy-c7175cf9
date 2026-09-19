/**
 * Shared gateway fee helpers — reads platform_settings.gateway_fees when available.
 */
export type GatewayFees = {
  mobile_money_fee_pct: number;
  card_fee_pct: number;
  paypal_fee_pct?: number;
};

export const DEFAULT_GATEWAY_FEES: GatewayFees = {
  mobile_money_fee_pct: 2.5,
  card_fee_pct: 3.5,
  paypal_fee_pct: 3.9,
};

export function parseGatewayFees(value: unknown): GatewayFees {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    mobile_money_fee_pct: Number(v.mobile_money_fee_pct) || DEFAULT_GATEWAY_FEES.mobile_money_fee_pct,
    card_fee_pct: Number(v.card_fee_pct) || DEFAULT_GATEWAY_FEES.card_fee_pct,
    paypal_fee_pct: Number(v.paypal_fee_pct) || DEFAULT_GATEWAY_FEES.paypal_fee_pct,
  };
}

/** Fee % for a payment_method value stored on orders. */
export function getGatewayRateForMethod(method: string, fees: GatewayFees = DEFAULT_GATEWAY_FEES): number {
  switch (method) {
    case "mobile_money":
      return fees.mobile_money_fee_pct;
    case "stripe":
    case "card":
      return fees.card_fee_pct;
    case "paypal":
      return fees.paypal_fee_pct ?? 3.9;
    case "cod":
    case "off_platform":
    case "unknown":
      return 0;
    default:
      return 0;
  }
}

/** Estimated vendor net on a gross amount (before cost of goods). */
export function estimateVendorNet(
  gross: number,
  commissionPct: number,
  paymentMethod: string,
  fees: GatewayFees = DEFAULT_GATEWAY_FEES,
): { commission: number; gatewayFee: number; net: number } {
  const commission = gross * (commissionPct / 100);
  const gatewayFee = gross * (getGatewayRateForMethod(paymentMethod, fees) / 100);
  return { commission, gatewayFee, net: Math.max(0, gross - commission - gatewayFee) };
}
