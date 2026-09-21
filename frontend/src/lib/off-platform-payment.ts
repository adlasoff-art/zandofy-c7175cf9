/** Deferred vendor-collected payments: off_platform + whatsapp (same confirmation pipeline). */

export const DEFERRED_VENDOR_PAYMENT_METHODS = ["off_platform", "whatsapp"] as const;
export type DeferredVendorPaymentMethod = (typeof DEFERRED_VENDOR_PAYMENT_METHODS)[number];

export function isDeferredVendorPaymentMethod(
  method: string | null | undefined,
): method is DeferredVendorPaymentMethod {
  return method === "off_platform" || method === "whatsapp";
}

/**
 * PostgREST OR filter: include deferred vendor payments that are awaiting_payment,
 * exclude other awaiting_payment (MoMo/card in flight).
 */
export const VENDOR_ORDERS_OR_FILTER =
  "and(status.eq.awaiting_payment,payment_method.in.(off_platform,whatsapp)),status.not.in.(awaiting_payment,payment_failed)";

export type OffPlatformOrderFields = {
  payment_method?: string | null;
  status?: string;
  /** Preuve paiement produit (hors plateforme / WhatsApp). */
  product_payment_proof_url?: string | null;
  /** Preuve expédition différée (ne pas confondre avec produit). */
  shipping_payment_proof_url?: string | null;
  shipping_payment_status?: string | null;
  off_platform_vendor_verified_at?: string | null;
  off_platform_admin_released_at?: string | null;
};

export function isPlatformOwnedStore(flag: boolean | null | undefined): boolean {
  return flag === true;
}

/** URL preuve produit hors plateforme (fallback legacy sur shipping_* avant backfill). */
export function offPlatformProductProofUrl(order: OffPlatformOrderFields): string | null {
  const product = order.product_payment_proof_url?.trim();
  if (product) return product;
  return order.shipping_payment_proof_url?.trim() || null;
}

export function hasOffPlatformPaymentProof(order: OffPlatformOrderFields): boolean {
  return !!offPlatformProductProofUrl(order);
}

/** @deprecated Prefer isDeferredVendorAwaitingPayment — kept for callers. */
export function isOffPlatformAwaitingPayment(order: OffPlatformOrderFields): boolean {
  return isDeferredVendorAwaitingPayment(order);
}

export function isDeferredVendorAwaitingPayment(order: OffPlatformOrderFields): boolean {
  return isDeferredVendorPaymentMethod(order.payment_method) && order.status === "awaiting_payment";
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
    isDeferredVendorAwaitingPayment(order) &&
    !!order.off_platform_vendor_verified_at &&
    !order.off_platform_admin_released_at;
  if (!base) return false;
  if (isPlatformOwned === undefined) return true;
  return isPlatformOwnedStore(isPlatformOwned);
}

/** Bloque les pastilles STATUS_FLOW tant que le paiement différé n'est pas tranché. */
export function blocksAdminStatusPillsForOffPlatform(order: OffPlatformOrderFields): boolean {
  return isDeferredVendorAwaitingPayment(order);
}

export function canAdminReleaseOffPlatform(
  order: OffPlatformOrderFields,
  allowOverrideWithoutVendor: boolean,
  isPlatformOwned?: boolean | null,
): boolean {
  // Défense en profondeur : jamais de libération admin sur boutique vendeur autonome.
  if (isPlatformOwned !== undefined && !isPlatformOwnedStore(isPlatformOwned)) return false;
  if (!isDeferredVendorAwaitingPayment(order)) return false;
  if (order.off_platform_admin_released_at) return false;
  if (!hasOffPlatformPaymentProof(order)) return false;
  if (order.off_platform_vendor_verified_at) return true;
  return allowOverrideWithoutVendor;
}

/**
 * Ne marquer l'expédition payée que si elle était encore "unpaid".
 * Les commandes hors plateforme / WhatsApp partent en "deferred" au checkout — ne pas écraser.
 * Statuts absents / null / deferred / paid → aucun patch (forward-safe).
 */
export function shippingStatusPatchForOffPlatformConfirm(
  currentShippingPaymentStatus?: string | null,
): { shipping_payment_status: "paid" } | Record<string, never> {
  if (currentShippingPaymentStatus === "unpaid") {
    return { shipping_payment_status: "paid" };
  }
  return {};
}

/** Boutique non-plateforme : le vendeur confirme le paiement produit → pending. */
export function vendorOffPlatformConfirmUpdates(
  now: string,
  userId: string,
  options?: {
    preserveVerifiedAt?: string | null;
    currentShippingPaymentStatus?: string | null;
  },
) {
  return {
    off_platform_vendor_verified_at: options?.preserveVerifiedAt || now,
    off_platform_vendor_verified_by: userId,
    status: "pending" as const,
    ...shippingStatusPatchForOffPlatformConfirm(options?.currentShippingPaymentStatus),
  };
}

/** Alias explicite (même payload que vendorOffPlatformConfirmUpdates). */
export function offPlatformProductConfirmFields(
  now: string,
  userId: string,
  currentShippingPaymentStatus?: string | null,
  options?: { preserveVerifiedAt?: string | null },
) {
  return vendorOffPlatformConfirmUpdates(now, userId, {
    preserveVerifiedAt: options?.preserveVerifiedAt,
    currentShippingPaymentStatus,
  });
}

/** Libération admin (boutique plateforme) → pending + timestamps admin. */
export function adminOffPlatformReleaseFields(
  now: string,
  userId: string,
  currentShippingPaymentStatus?: string | null,
) {
  return {
    status: "pending" as const,
    off_platform_admin_released_at: now,
    off_platform_admin_released_by: userId,
    ...shippingStatusPatchForOffPlatformConfirm(currentShippingPaymentStatus),
  };
}

/** Boutique plateforme : le vendeur valide la preuve seulement ; l'admin libère ensuite. */
export function vendorOffPlatformVerifyOnlyUpdates(now: string, userId: string) {
  return {
    off_platform_vendor_verified_at: now,
    off_platform_vendor_verified_by: userId,
  };
}

export function deferredPaymentMethodLabel(method: string | null | undefined): string {
  if (method === "whatsapp") return "WhatsApp";
  if (method === "off_platform") return "Hors plateforme";
  return method || "";
}
