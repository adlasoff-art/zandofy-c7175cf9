import { supabase } from "@/integrations/supabase/client";

export interface EligibleForwarder {
  forwarder_id: string;
  forwarder_name: string;
  forwarder_slug: string;
  logo_url: string | null;
  tier: string;
  price_multiplier: number;
  transit_min_days: number | null;
  transit_max_days: number | null;
}

export interface ForwardersConfig {
  enabled: boolean;
  fallback_mode: "auto_calc" | "block";
  require_selection: boolean;
}

const DEFAULT_CONFIG: ForwardersConfig = {
  enabled: false,
  fallback_mode: "auto_calc",
  require_selection: true,
};

export async function fetchForwardersConfig(): Promise<ForwardersConfig> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "forwarders_config")
    .maybeSingle();
  if (error || !data?.value) return DEFAULT_CONFIG;
  const v = data.value as any;
  return {
    enabled: v.enabled === true,
    fallback_mode: v.fallback_mode === "block" ? "block" : "auto_calc",
    require_selection: v.require_selection !== false,
  };
}

export async function fetchEligibleForwarders(params: {
  country: string;
  cityId?: string | null;
  mode: string;
}): Promise<EligibleForwarder[]> {
  if (!params.country || !params.mode) return [];
  const { data, error } = await (supabase.rpc as any)("get_eligible_forwarders", {
    p_country: params.country.toUpperCase(),
    p_city_id: params.cityId ?? null,
    p_mode: params.mode,
  });
  if (error) {
    console.error("[forwarders] get_eligible_forwarders failed", error);
    return [];
  }
  return (data || []) as EligibleForwarder[];
}