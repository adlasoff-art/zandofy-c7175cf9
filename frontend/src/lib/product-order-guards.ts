import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_ORDER_STATUSES } from "@/lib/order-status";

/** Statuses that lock product price (includes unpaid gateway orders). */
export const PRICE_LOCK_ORDER_STATUSES = [
  "awaiting_payment",
  ...ACTIVE_ORDER_STATUSES,
] as const;

export { ACTIVE_ORDER_STATUSES };

export type ProductOrderGuardState = {
  hasAnyOrders: boolean;
  hasActiveOrders: boolean;
  /** True when RPC failed — UI must fail closed */
  guardError: boolean;
};

export async function fetchProductOrderGuards(
  productId: string
): Promise<ProductOrderGuardState> {
  const sb = supabase as any;
  const [anyRes, activeRes] = await Promise.all([
    sb.rpc("product_has_any_orders", { p_product_id: productId }),
    sb.rpc("product_has_active_orders", { p_product_id: productId }),
  ]);

  const guardError = !!(anyRes.error || activeRes.error);
  if (anyRes.error) {
    console.error("product_has_any_orders", anyRes.error);
  }
  if (activeRes.error) {
    console.error("product_has_active_orders", activeRes.error);
  }

  // Fail closed on RPC error: treat as locked / has history
  if (guardError) {
    return { hasAnyOrders: true, hasActiveOrders: true, guardError: true };
  }

  return {
    hasAnyOrders: !!anyRes.data,
    hasActiveOrders: !!activeRes.data,
    guardError: false,
  };
}

export function priceLockedMessage(hasActiveOrders: boolean): string {
  return hasActiveOrders
    ? "Prix verrouillé — une commande est en cours pour ce produit."
    : "";
}

export function deleteBlockedMessage(hasActiveOrders: boolean): string {
  return hasActiveOrders
    ? "Impossible de supprimer : une commande est en cours."
    : "Impossible de supprimer un produit déjà commandé. Le produit a été dépublié.";
}

/** Pure helper for tests: price-lock status membership. */
export function isActiveOrderStatus(status: string): boolean {
  return (PRICE_LOCK_ORDER_STATUSES as readonly string[]).includes(status);
}
