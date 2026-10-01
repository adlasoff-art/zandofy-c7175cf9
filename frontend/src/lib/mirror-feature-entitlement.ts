import { supabase } from "@/integrations/supabase/client";

/**
 * Mirror admin toggle onto store_feature_entitlements (grant vs revoke).
 * Keeps legacy columns as source of write; entitlements for read resolution.
 */
export async function mirrorFeatureEntitlement(
  storeId: string,
  featureKey: string,
  enabled: boolean,
): Promise<void> {
  try {
    if (enabled) {
      await (supabase as any)
        .from("store_feature_entitlements")
        .delete()
        .eq("store_id", storeId)
        .eq("feature_key", featureKey)
        .eq("source", "admin_revoke");

      await (supabase as any).from("store_feature_entitlements").upsert(
        {
          store_id: storeId,
          feature_key: featureKey,
          source: "admin_grant",
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,feature_key,source" },
      );
    } else {
      await (supabase as any)
        .from("store_feature_entitlements")
        .delete()
        .eq("store_id", storeId)
        .eq("feature_key", featureKey)
        .eq("source", "admin_grant");

      await (supabase as any).from("store_feature_entitlements").upsert(
        {
          store_id: storeId,
          feature_key: featureKey,
          source: "admin_revoke",
          enabled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,feature_key,source" },
      );
    }
  } catch {
    // Non-blocking: legacy columns remain authoritative until RPC deployed
  }
}
