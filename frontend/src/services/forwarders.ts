import { supabase } from "@/integrations/supabase/client";

export interface EligibleForwarder {
  forwarder_id: string;
  forwarder_name: string;
  forwarder_slug: string;
  logo_url: string | null;
  tier: string;
  mode: string;
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

export interface ForwarderEligibilityDebug {
  forwarder_id: string;
  forwarder_name: string;
  status: string;
  is_active: boolean;
  supports_mode: boolean;
  has_route: boolean;
  has_exact_city_profile: boolean;
  has_country_profile: boolean;
  has_kg_tier: boolean;
  has_cbm_tier: boolean;
  has_piece_tier: boolean;
  picked_profile_id: string | null;
  would_be_eligible: boolean;
  reason: string;
}

/**
 * Admin-only : explique pour chaque transitaire pourquoi il est (ou non)
 * proposé au checkout pour un couple (origine, destination, ville, mode).
 * Renvoie [] si l'utilisateur n'est pas admin (RPC RAISE EXCEPTION).
 */
export async function debugForwarderEligibility(params: {
  originCountry: string;
  destinationCountry: string;
  destinationCityId?: string | null;
  mode: string;
}): Promise<ForwarderEligibilityDebug[]> {
  if (!params.originCountry || !params.destinationCountry || !params.mode) return [];
  const { data, error } = await (supabase.rpc as any)(
    "debug_forwarder_checkout_eligibility",
    {
      p_origin_country: params.originCountry.toUpperCase(),
      p_destination_country: params.destinationCountry.toUpperCase(),
      p_destination_city_id: params.destinationCityId ?? null,
      p_mode: params.mode,
    },
  );
  if (error) {
    console.warn("[forwarders] debug_forwarder_checkout_eligibility failed", error);
    return [];
  }
  return (data ?? []) as ForwarderEligibilityDebug[];
}