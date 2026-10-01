/**
 * Filter carrier lists by store/product allowlists.
 * Empty allowlist (RPC returns null) ⇒ no filter.
 */
import { supabase } from "@/integrations/supabase/client";
import type { FulfillmentLane } from "@/lib/fulfillment-lane";

export async function getCarrierAllowlistIds(params: {
  storeId: string | null | undefined;
  productIds?: string[];
  carrierType: "operator" | "forwarder";
  lane?: FulfillmentLane | null;
}): Promise<string[] | null> {
  if (!params.storeId) return null;
  const { data, error } = await (supabase as any).rpc("get_carrier_allowlist_ids", {
    p_store_id: params.storeId,
    p_product_ids: params.productIds || [],
    p_carrier_type: params.carrierType,
    p_lane: params.lane || null,
  });
  if (error) {
    console.warn("[allowlist]", error.message);
    return null;
  }
  if (data == null) return null;
  return (data as string[]).map(String);
}

export function filterByAllowlist<T extends { id?: string; operator_id?: string; forwarder_id?: string }>(
  items: T[],
  allowlist: string[] | null,
  idKey: "id" | "operator_id" | "forwarder_id" = "id",
): T[] {
  if (!allowlist || allowlist.length === 0) return items;
  const set = new Set(allowlist);
  return items.filter((item) => {
    const id = (item as any)[idKey] || (item as any).id;
    return id && set.has(String(id));
  });
}
