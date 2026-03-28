/**
 * Hook to fetch payment numbers for a store at checkout.
 * If the store has custom numbers enabled, returns store-specific numbers.
 * Otherwise, returns platform default numbers from platform_settings.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentNumber {
  operator: string;
  operator_label: string;
  phone_number: string;
  display_name: string;
  sort_order: number;
}

async function fetchPaymentNumbers(storeIds: string[]): Promise<PaymentNumber[]> {
  if (storeIds.length === 0) return [];

  // Check if stores have custom payment numbers enabled
  const { data: overrides } = await (supabase as any)
    .from("vendor_pricing_overrides")
    .select("store_id, vendor_custom_payment_numbers_enabled")
    .in("store_id", storeIds);

  const customEnabledStores = (overrides || [])
    .filter((o: any) => o.vendor_custom_payment_numbers_enabled === true)
    .map((o: any) => o.store_id);

  // If any store has custom numbers enabled, fetch those
  if (customEnabledStores.length > 0) {
    // For multi-store carts, use first store with custom numbers
    const targetStoreId = customEnabledStores[0];
    const { data: storeNumbers } = await (supabase as any)
      .from("store_payment_numbers")
      .select("operator, operator_label, phone_number, display_name, sort_order")
      .eq("store_id", targetStoreId)
      .eq("is_active", true)
      .order("sort_order");

    if (storeNumbers && storeNumbers.length > 0) {
      return storeNumbers.filter((n: PaymentNumber) => n.phone_number.trim() !== "");
    }
  }

  // Fallback: platform default numbers
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "default_payment_numbers")
    .maybeSingle();

  if (data?.value && typeof data.value === "object") {
    const v = data.value as any;
    const numbers = (v.numbers || []) as PaymentNumber[];
    return numbers.filter((n) => n.phone_number.trim() !== "");
  }

  return [];
}

export function useStorePaymentNumbers(storeIds: string[]) {
  return useQuery({
    queryKey: ["store-payment-numbers", ...storeIds],
    queryFn: () => fetchPaymentNumbers(storeIds),
    enabled: storeIds.length > 0,
    staleTime: 60_000,
  });
}
