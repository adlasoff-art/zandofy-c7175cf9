import { getGatewayRateForMethod, type GatewayFees } from "@/lib/gateway-fees";
import { NON_REVENUE_ORDER_STATUSES } from "@/lib/order-status";

export const GATEWAY_PAYMENT_METHODS = ["mobile_money", "card", "stripe", "paypal"] as const;

export interface AdminOrderEconomicsInput {
  subtotal: number | null | undefined;
  status: string;
  paymentMethod: string | null | undefined;
  storeCommissionPct: number | null | undefined;
}

export interface AdminOrderEconomics {
  gmv: number;
  gatewayFees: number;
  platformCommission: number;
  netVendor: number;
}

export function isGatewayPayment(method: string | null | undefined): boolean {
  return GATEWAY_PAYMENT_METHODS.includes((method || "") as (typeof GATEWAY_PAYMENT_METHODS)[number]);
}

export function calculateAdminOrderEconomics(
  order: AdminOrderEconomicsInput,
  gatewayFees: GatewayFees,
): AdminOrderEconomics {
  if (NON_REVENUE_ORDER_STATUSES.includes(order.status as (typeof NON_REVENUE_ORDER_STATUSES)[number])) {
    return { gmv: 0, gatewayFees: 0, platformCommission: 0, netVendor: 0 };
  }

  const gmv = Math.max(0, Number(order.subtotal) || 0);
  const method = order.paymentMethod || "unknown";
  const gateway = isGatewayPayment(method);
  const gatewayFeeAmount = gmv * (getGatewayRateForMethod(method, gatewayFees) / 100);
  const platformCommission = gateway
    ? gmv * (Math.max(0, Number(order.storeCommissionPct) || 0) / 100)
    : 0;

  return {
    gmv,
    gatewayFees: gatewayFeeAmount,
    platformCommission,
    netVendor: gmv - gatewayFeeAmount - platformCommission,
  };
}
