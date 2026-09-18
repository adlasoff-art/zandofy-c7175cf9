import { supabase } from "@/integrations/supabase/client";

export interface QuoteItem {
  category_id?: string;
  custom_label?: string;
  quantity: number;
  cbm: number;
  /** Real weight (kg). For TMS kg path pass total weight with quantity=1. */
  weight_kg?: number;
}

export type BillingBasis = "per_kg" | "flat" | "per_piece" | "cbm";

/** Raw shape returned by quote_forwarder (SECURITY DEFINER RPC). */
export interface QuoteForwarderRpcResult {
  profile_id?: string;
  currency?: string;
  total?: number;
  split_total?: number;
  subpackages?: Array<{
    tier_used?: string;
    line_total?: number;
    billable_weight_kg?: number;
    cbm?: number;
  }>;
  deposit_required?: boolean;
  deposit_pct?: number;
  transit_min_days?: number | null;
  transit_max_days?: number | null;
  restrictions?: Array<{ type: string; label: string; icon: string | null }>;
  consolidation_offer?: unknown;
  error?: string;
}

export function billingBasisFromRpc(
  tierUsed: string | undefined,
  opts?: { kgTierIsFlat?: boolean },
): BillingBasis {
  if (tierUsed === "piece") return "per_piece";
  if (tierUsed === "cbm") return "cbm";
  if (tierUsed === "flat") return "flat";
  if (tierUsed === "kg" && opts?.kgTierIsFlat) return "flat";
  return "per_kg";
}

export async function quoteForwarder(params: {
  profileId: string;
  items: QuoteItem[];
  totalCbm?: number;
  consolidationChoice?: "split" | "consolidated";
}): Promise<QuoteForwarderRpcResult | null> {
  const { data, error } = await (supabase.rpc as any)("quote_forwarder", {
    p_profile_id: params.profileId,
    p_items: params.items,
    p_total_cbm: params.totalCbm ?? null,
    p_consolidation_choice: params.consolidationChoice ?? "split",
  });
  if (error) {
    console.error("[forwarder-pricing] quote_forwarder failed", error);
    return { error: error.message };
  }
  return (data ?? null) as QuoteForwarderRpcResult | null;
}

export async function fetchForwarderProfile(params: {
  forwarderId: string;
  mode: string;
  countryCode: string;
  cityId?: string | null;
}) {
  let q = (supabase as any)
    .from("v_forwarder_profiles_public")
    .select("*")
    .eq("forwarder_id", params.forwarderId)
    .eq("mode", params.mode)
    .eq("country_code", params.countryCode.toUpperCase());
  if (params.cityId) q = q.eq("city_id", params.cityId);
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error("[forwarder-pricing] fetch profile failed", error);
    return null;
  }
  return data;
}
