import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VENDOR_TIERS, type VendorTier } from "@/lib/vendor-tiers";

export interface VendorSubscription {
  id: string;
  store_id: string;
  tier: VendorTier;
  max_products: number;
  is_whatsapp_enabled: boolean;
  can_self_deliver: boolean;
  payment_method: string | null;
  paid_until: string | null;
}

const DEFAULT_SUB: Omit<VendorSubscription, "id" | "store_id"> = {
  tier: "beginner",
  max_products: 10,
  is_whatsapp_enabled: false,
  can_self_deliver: false,
  payment_method: null,
  paid_until: null,
};

export function useVendorSubscription(storeId: string | null) {
  const [subscription, setSubscription] = useState<VendorSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) { setLoading(false); return; }

    async function load() {
      const { data } = await supabase
        .from("vendor_subscriptions")
        .select("*")
        .eq("store_id", storeId!)
        .maybeSingle();

      if (data) {
        setSubscription(data as unknown as VendorSubscription);
      } else {
        // No subscription row yet → default beginner
        setSubscription({
          id: "",
          store_id: storeId!,
          ...DEFAULT_SUB,
        });
      }
      setLoading(false);
    }
    load();
  }, [storeId]);

  const tierConfig = subscription
    ? VENDOR_TIERS[subscription.tier] || VENDOR_TIERS.beginner
    : VENDOR_TIERS.beginner;

  const canAddProduct = (currentCount: number) => currentCount < (subscription?.max_products ?? 10);

  return { subscription, loading, tierConfig, canAddProduct };
}
