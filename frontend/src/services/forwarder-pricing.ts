import { supabase } from "@/integrations/supabase/client";

export interface QuoteItem {
  category_id?: string;
  custom_label?: string;
  quantity: number;
  cbm: number;
}

export interface ForwarderQuote {
  profile_id: string;
  currency: string;
  total: number;
  total_cbm: number;
  breakdown: Array<{
    type: "piece_tier" | "cbm_tier";
    label: string;
    unit?: string;
    unit_price?: number;
    quantity?: number;
    cbm?: number;
    includes_customs?: boolean;
    line_total?: number;
    quote_only?: boolean;
  }>;
  deposit_required: boolean;
  deposit_pct: number;
  deposit_amount: number;
  transit_min_days: number | null;
  transit_max_days: number | null;
  restrictions: Array<{ type: "forbidden" | "license_required" | "info"; label: string; icon: string | null }>;
  error?: string;
}

export async function quoteForwarder(params: {
  profileId: string;
  items: QuoteItem[];
  totalCbm?: number;
}): Promise<ForwarderQuote | null> {
  const { data, error } = await (supabase.rpc as any)("quote_forwarder", {
    p_profile_id: params.profileId,
    p_items: params.items,
    p_total_cbm: params.totalCbm ?? null,
  });
  if (error) {
    console.error("[forwarder-pricing] quote_forwarder failed", error);
    return null;
  }
  return data as ForwarderQuote;
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