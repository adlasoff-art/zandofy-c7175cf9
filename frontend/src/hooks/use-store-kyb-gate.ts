import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StoreKybGate {
  exempt: boolean;
  required: boolean;
  blocked: boolean;
  soft_warn: boolean;
  shop_type?: string;
  gmv?: number;
  threshold?: number;
  kyb_status?: string | null;
  /** True when RPC failed and we fail-closed for writes */
  rpc_error?: boolean;
}

/**
 * KYB gate for a store.
 * - Missing RPC (migration not applied): fail-open so staging before SQL still sells.
 * - Any other RPC error: fail-closed (block catalog/promo/withdraw UI writes).
 */
export function useStoreKybGate(storeId: string | undefined | null) {
  return useQuery({
    queryKey: ["store-kyb-gate", storeId],
    queryFn: async (): Promise<StoreKybGate> => {
      if (!storeId) {
        return { exempt: true, required: false, blocked: false, soft_warn: false };
      }
      const { data, error } = await (supabase as any).rpc("store_kyb_gate", {
        p_store_id: storeId,
      });
      if (error || !data) {
        const msg = error?.message || "";
        const missingFn = /does not exist|42883|Could not find the function/i.test(msg);
        console.warn("[store_kyb_gate]", msg);
        if (missingFn) {
          return { exempt: true, required: false, blocked: false, soft_warn: false, rpc_error: true };
        }
        // Fail-closed for write paths when gate is unavailable unexpectedly
        return {
          exempt: false,
          required: true,
          blocked: true,
          soft_warn: false,
          rpc_error: true,
        };
      }
      return data as StoreKybGate;
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });
}
