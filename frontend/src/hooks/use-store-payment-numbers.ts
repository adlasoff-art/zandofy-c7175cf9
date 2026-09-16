/**
 * Hook to fetch payment numbers for a store at checkout.
 * Vendor MM numbers only if:
 *   - admin grandfather (mm_granted_by_admin), OR
 *   - active vendor_mm_numbers package (paid_until > now)
 * Otherwise → platform default numbers.
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

async function storeHasActiveMmAccess(storeId: string): Promise<boolean> {
  const { data: override, error: ovErr } = await (supabase as any)
    .from("vendor_pricing_overrides")
    .select("vendor_custom_payment_numbers_enabled, mm_granted_by_admin")
    .eq("store_id", storeId)
    .maybeSingle();

  // Before harden migration: fall back to flag-only (legacy)
  if (ovErr) {
    const { data: legacy } = await (supabase as any)
      .from("vendor_pricing_overrides")
      .select("vendor_custom_payment_numbers_enabled")
      .eq("store_id", storeId)
      .maybeSingle();
    if (legacy?.vendor_custom_payment_numbers_enabled === true) return true;
  } else if (
    override?.mm_granted_by_admin === true &&
    override?.vendor_custom_payment_numbers_enabled === true
  ) {
    return true;
  } else if (
    // Legacy rows before column exists / null treated as grandfather if enabled
    override?.vendor_custom_payment_numbers_enabled === true &&
    override?.mm_granted_by_admin == null
  ) {
    return true;
  }

  // Paid self-serve forfait (source of truth for expiry)
  const { data: subs } = await (supabase as any)
    .from("store_package_subscriptions")
    .select("paid_until, is_active, service_packages!inner(slug)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .eq("service_packages.slug", "vendor_mm_numbers")
    .limit(1);

  const sub = subs?.[0];
  if (!sub) return false;
  if (sub.paid_until && new Date(sub.paid_until).getTime() <= Date.now()) return false;
  return true;
}

async function fetchPlatformDefaults(): Promise<PaymentNumber[]> {
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

async function fetchPaymentNumbers(storeIds: string[]): Promise<PaymentNumber[]> {
  if (storeIds.length === 0) return [];

  for (const storeId of storeIds) {
    const allowed = await storeHasActiveMmAccess(storeId);
    if (!allowed) continue;

    const { data: storeNumbers } = await (supabase as any)
      .from("store_payment_numbers")
      .select("operator, operator_label, phone_number, display_name, sort_order")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .order("sort_order");

    const cleaned = (storeNumbers || []).filter(
      (n: PaymentNumber) => n.phone_number && n.phone_number.trim() !== ""
    );
    if (cleaned.length > 0) return cleaned;
  }

  return fetchPlatformDefaults();
}

export function useStorePaymentNumbers(storeIds: string[]) {
  return useQuery({
    queryKey: ["store-payment-numbers", ...storeIds],
    queryFn: () => fetchPaymentNumbers(storeIds),
    enabled: storeIds.length > 0,
    staleTime: 60_000,
  });
}
