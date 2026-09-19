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

export function isPlatformOwnedStore(flag: boolean | null | undefined): boolean {
  return flag === true;
}

export function hasOffPlatformPaymentProof(order: OffPlatformOrderFields): boolean {
  return !!order.shipping_payment_proof_url?.trim();
}

export function isOffPlatformAwaitingPayment(order: OffPlatformOrderFields): boolean {
  return order.payment_method === "off_platform" && order.status === "awaiting_payment";
}

/**
 * File admin « à libérer » : preuve validée vendeur, pas encore libérée.
 * Si `isPlatformOwned` est fourni, uniquement les boutiques plateforme
 * (les vendeurs autonomes confirment eux-mêmes → pending).
 */
export function isOffPlatformAwaitingAdminRelease(
  order: OffPlatformOrderFields,
  isPlatformOwned?: boolean | null,
): boolean {
  const base =
    isOffPlatformAwaitingPayment(order) &&
    !!order.off_platform_vendor_verified_at &&
    !order.off_platform_admin_released_at;
  if (!base) return false;
  if (isPlatformOwned === undefined) return true;
  return isPlatformOwnedStore(isPlatformOwned);
}

/** Bloque les pastilles STATUS_FLOW tant que le paiement hors plateforme n'est pas tranché. */
export function blocksAdminStatusPillsForOffPlatform(order: OffPlatformOrderFields): boolean {
  return isOffPlatformAwaitingPayment(order);
}

export function canAdminReleaseOffPlatform(
  order: OffPlatformOrderFields,
  allowOverrideWithoutVendor: boolean,
  isPlatformOwned?: boolean | null,
): boolean {
  // Défense en profondeur : jamais de libération admin sur boutique vendeur autonome.
  if (isPlatformOwned !== undefined && !isPlatformOwnedStore(isPlatformOwned)) return false;
  if (!isOffPlatformAwaitingPayment(order)) return false;
  if (order.off_platform_admin_released_at) return false;
  if (!hasOffPlatformPaymentProof(order)) return false;
  if (order.off_platform_vendor_verified_at) return true;
  return allowOverrideWithoutVendor;
}

/** Boutique non-plateforme : le vendeur confirme → pending + paid. */
export function vendorOffPlatformConfirmUpdates(
  now: string,
  userId: string,
  options?: { preserveVerifiedAt?: string | null },
) {
  return {
    off_platform_vendor_verified_at: options?.preserveVerifiedAt || now,
    off_platform_vendor_verified_by: userId,
    status: "pending" as const,
    shipping_payment_status: "paid" as const,
  };
}

/** Boutique plateforme : le vendeur valide la preuve seulement ; l'admin libère ensuite. */
export function vendorOffPlatformVerifyOnlyUpdates(now: string, userId: string) {
  return {
    off_platform_vendor_verified_at: now,
    off_platform_vendor_verified_by: userId,
  };
}
