/** PostgREST filter: inclure off_platform + awaiting_payment, exclure les autres awaiting_payment. */
export const VENDOR_ORDERS_OR_FILTER =
  "and(status.eq.awaiting_payment,payment_method.eq.off_platform),status.not.in.(awaiting_payment,payment_failed)";

export type OffPlatformOrderFields = {
  payment_method?: string | null;
  status?: string;
  shipping_payment_proof_url?: string | null;
  off_platform_vendor_verified_at?: string | null;
  off_platform_admin_released_at?: string | null;
};

export function isOffPlatformAwaitingPayment(order: OffPlatformOrderFields): boolean {
  return order.payment_method === "off_platform" && order.status === "awaiting_payment";
}

/** File admin : preuve validée par le vendeur, en attente de libération. */
export function isOffPlatformAwaitingAdminRelease(order: OffPlatformOrderFields): boolean {
  return (
    isOffPlatformAwaitingPayment(order) &&
    !!order.off_platform_vendor_verified_at &&
    !order.off_platform_admin_released_at
  );
}

/** Bloque les pastilles STATUS_FLOW pour éviter un pending sans libération dédiée. */
export function blocksAdminStatusPillsForOffPlatform(order: OffPlatformOrderFields): boolean {
  return isOffPlatformAwaitingPayment(order);
}

export function canAdminReleaseOffPlatform(
  order: OffPlatformOrderFields,
  allowOverrideWithoutVendor: boolean,
): boolean {
  if (!isOffPlatformAwaitingPayment(order)) return false;
  if (order.off_platform_admin_released_at) return false;
  if (!order.shipping_payment_proof_url?.trim()) return false;
  if (order.off_platform_vendor_verified_at) return true;
  return allowOverrideWithoutVendor;
}
