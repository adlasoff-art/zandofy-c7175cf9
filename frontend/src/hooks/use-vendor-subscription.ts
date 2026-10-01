import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VENDOR_TIERS, type VendorTier } from "@/lib/vendor-tiers";
import { useStoreEntitlements } from "@/hooks/use-store-entitlements";

export interface VendorSubscription {
  id: string;
  store_id: string;
  tier: VendorTier;
  max_products: number;
  is_whatsapp_enabled: boolean;
  can_self_deliver: boolean;
  payment_method: string | null;
  paid_until: string | null;
  active_services: Record<string, boolean> | null;
}

const DEFAULT_SUB: Omit<VendorSubscription, "id" | "store_id"> = {
  tier: "beginner",
  max_products: 20,
  is_whatsapp_enabled: false,
  can_self_deliver: false,
  payment_method: null,
  paid_until: null,
  active_services: null,
};

export function useVendorSubscription(storeId: string | null) {
  const [subscription, setSubscription] = useState<VendorSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [maxProductsOverride, setMaxProductsOverride] = useState<number | null>(null);
  const { data: entitlements } = useStoreEntitlements(storeId);

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    async function load() {
      const [subRes, overrideRes] = await Promise.all([
        supabase
          .from("vendor_subscriptions")
          .select("*")
          .eq("store_id", storeId!)
          .maybeSingle(),
        (supabase as any)
          .from("vendor_pricing_overrides")
          .select("max_products_override")
          .eq("store_id", storeId!)
          .maybeSingle(),
      ]);

      const adminOverride = overrideRes.data?.max_products_override ?? null;
      setMaxProductsOverride(adminOverride);

      if (subRes.data) {
        const sub = subRes.data as unknown as VendorSubscription;
        if (adminOverride != null) {
          sub.max_products = adminOverride;
        }
        setSubscription(sub);
      } else {
        setSubscription({
          id: "",
          store_id: storeId!,
          ...DEFAULT_SUB,
          max_products: adminOverride ?? DEFAULT_SUB.max_products,
        });
      }
      setLoading(false);
    }
    load();
  }, [storeId]);

  const planSlug = (entitlements?.plan_slug || subscription?.tier || "beginner") as VendorTier;
  const tierConfig =
    VENDOR_TIERS[planSlug] ||
    VENDOR_TIERS[(subscription?.tier as VendorTier) || "beginner"] ||
    VENDOR_TIERS.beginner;

  // Prefer RPC max_products when available; else override / subscription
  const effectiveMaxProducts =
    entitlements?.max_products ??
    maxProductsOverride ??
    subscription?.max_products ??
    20;
  const canAddProduct = (currentCount: number) => currentCount < effectiveMaxProducts;

  return {
    subscription,
    loading,
    tierConfig,
    canAddProduct,
    effectiveMaxProducts,
    entitlements: entitlements ?? null,
  };
}
