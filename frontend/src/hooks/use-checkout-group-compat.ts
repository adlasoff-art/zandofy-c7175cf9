import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  evaluateGroupCheckout,
  type CompatStoreInput,
  type GroupCompatResult,
  compatReasonMessageFr,
} from "@/lib/checkout-group-compat";

/**
 * Server-backed group checkout compatibility for selected store IDs.
 * Falls back to client evaluate if RPC missing (pre-migration).
 */
export function useCheckoutGroupCompat(storeIds: string[]) {
  const sorted = [...new Set(storeIds.filter(Boolean))].sort();
  const key = sorted.join(",");

  return useQuery({
    queryKey: ["checkout-group-compat", key],
    enabled: sorted.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<GroupCompatResult & { messageFr: string }> => {
      if (sorted.length <= 1) {
        const r = evaluateGroupCheckout(
          sorted.map((id) => ({
            id,
            owner_id: "self",
            group_checkout_policy: "multi_vendor_ok",
            paymentFlags: {
              mobile_money: true,
              card: true,
              paypal: true,
              cod: false,
              off_platform: false,
              whatsapp: false,
            },
          }))
        );
        return { ...r, messageFr: compatReasonMessageFr(r.reasonCode) };
      }

      const { data, error } = await (supabase as any).rpc("get_checkout_group_compat", {
        p_store_ids: sorted,
      });

      if (!error && data && typeof data === "object") {
        const r = data as GroupCompatResult;
        return {
          ok: !!r.ok,
          reasonCode: r.reasonCode || "EMPTY",
          eligiblePaymentMethods: r.eligiblePaymentMethods || [],
          blockingStoreIds: (r.blockingStoreIds || []).map(String),
          allDeferred: !!r.allDeferred,
          messageFr: compatReasonMessageFr(r.reasonCode || "EMPTY"),
        };
      }

      // Fallback: load stores + flags client-side
      const { data: stores } = await (supabase as any)
        .from("stores")
        .select("id, owner_id, shop_type, group_checkout_policy")
        .in("id", sorted);
      const { data: flags } = await (supabase as any).rpc(
        "get_checkout_vendor_payment_flags",
        { p_store_ids: sorted }
      );
      const flagMap = new Map(
        ((flags || []) as any[]).map((f) => [f.store_id, f])
      );
      const inputs: CompatStoreInput[] = ((stores || []) as any[]).map((s) => {
        const f = flagMap.get(s.id) || {};
        return {
          id: s.id,
          owner_id: s.owner_id,
          shop_type: s.shop_type,
          group_checkout_policy: s.group_checkout_policy || "multi_vendor_ok",
          paymentFlags: {
            mobile_money: f.vendor_mobile_money_enabled !== false,
            card: f.vendor_card_enabled !== false,
            paypal: true,
            cod: f.vendor_cod_enabled === true,
            off_platform: f.vendor_off_platform_enabled === true,
            whatsapp: f.vendor_whatsapp_enabled === true,
          },
        };
      });
      const r = evaluateGroupCheckout(inputs);
      return { ...r, messageFr: compatReasonMessageFr(r.reasonCode) };
    },
  });
}
