/**
 * Hook to fetch vendor off-platform payment numbers at checkout.
 * Uses SECURITY DEFINER RPC (bypasses owner-only RLS) and never mixes in
 * platform default numbers — those are for platform MoMo, not off-platform.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentNumber {
  store_id?: string;
  operator: string;
  operator_label: string;
  phone_number: string;
  display_name: string;
  sort_order: number;
  is_preferred?: boolean;
  qr_image_url?: string | null;
}

async function fetchPaymentNumbers(storeIds: string[]): Promise<PaymentNumber[]> {
  if (storeIds.length === 0) return [];

  const { data, error } = await (supabase as any).rpc("get_checkout_off_platform_numbers", {
    p_store_ids: storeIds,
  });

  if (error) {
    console.warn("[checkout] get_checkout_off_platform_numbers:", error.message);
    return [];
  }

  const rows = (data || []) as PaymentNumber[];
  return [...rows]
    .filter((n) => n.phone_number?.trim())
    .sort(
      (a, b) =>
        Number(!!b.is_preferred) - Number(!!a.is_preferred) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
}

export function useStorePaymentNumbers(storeIds: string[]) {
  return useQuery({
    queryKey: ["store-payment-numbers", [...storeIds].sort().join(",")],
    queryFn: () => fetchPaymentNumbers(storeIds),
    enabled: storeIds.length > 0,
    staleTime: 60_000,
  });
}
