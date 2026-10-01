import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StoreEntitlements = {
  ok: boolean;
  plan_slug?: string;
  plan_label?: string;
  max_products?: number;
  max_stores?: number;
  collaborator_limit?: number | null;
  included_deliveries_per_month?: number;
  max_kg_per_included_delivery?: number;
  features?: Record<string, boolean>;
  error?: string;
};

/**
 * Resolved store entitlements from get_store_entitlements.
 * Fail-soft: returns null on error so callers keep legacy flags.
 */
export function useStoreEntitlements(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["store-entitlements", storeId],
    enabled: !!storeId,
    staleTime: 30_000,
    queryFn: async (): Promise<StoreEntitlements | null> => {
      const { data, error } = await (supabase as any).rpc("get_store_entitlements", {
        p_store_id: storeId,
      });
      if (error || !data || typeof data !== "object") return null;
      const res = data as StoreEntitlements;
      if (res.ok !== true) return null;
      return res;
    },
  });
}

export function hasFeature(
  entitlements: StoreEntitlements | null | undefined,
  key: string,
  legacyFallback?: boolean,
): boolean {
  if (entitlements?.features && key in entitlements.features) {
    return entitlements.features[key] === true;
  }
  return legacyFallback === true;
}
