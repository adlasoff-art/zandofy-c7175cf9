import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiscoveryMixConfig = {
  core_pct: number;
  explore_pct: number;
  neutral_pct: number;
  /** Of total feed when purchase_scope = city */
  city_pct: number;
  /** Of total feed when purchase_scope = city (with city_pct should ≈ core_pct) */
  country_within_core_pct: number;
  rotation_hours: number;
  /**
   * Max % of take that may be international when scope is city/country (0–25).
   * Ignored for any_country. Default 10 when absent (backward compatible).
   */
  intl_cap_pct: number;
};

export type AuthSettings = {
  mode: "fluid" | "strict";
  collect_phone_on_signup: boolean;
  address_onboarding_enabled: boolean;
  gate_checkout_on_email_confirm: boolean;
  discovery_onboarding_enabled: boolean;
  discovery_onboarding_steps: {
    payment: boolean;
    receipt: boolean;
  };
  discovery_mix: DiscoveryMixConfig;
  /** Seconds after discovery complete/dismiss before CMS announcement popup */
  discovery_popup_delay_sec: number;
};

export const DISCOVERY_MIX_DEFAULTS: DiscoveryMixConfig = {
  core_pct: 65,
  explore_pct: 25,
  neutral_pct: 10,
  city_pct: 45,
  country_within_core_pct: 20,
  rotation_hours: 12,
  intl_cap_pct: 10,
};

export const AUTH_SETTINGS_DEFAULTS: AuthSettings = {
  mode: "fluid",
  collect_phone_on_signup: true,
  address_onboarding_enabled: true,
  gate_checkout_on_email_confirm: false,
  discovery_onboarding_enabled: true,
  discovery_onboarding_steps: {
    payment: true,
    receipt: true,
  },
  discovery_mix: { ...DISCOVERY_MIX_DEFAULTS },
  discovery_popup_delay_sec: 15,
};

export const AUTH_SETTINGS_QUERY_KEY = ["platform-auth-settings"] as const;

function clampPct(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, Math.round(v)));
}

export function normalizeDiscoveryMix(raw: unknown): DiscoveryMixConfig {
  const d = DISCOVERY_MIX_DEFAULTS;
  if (!raw || typeof raw !== "object") return { ...d };
  const v = raw as Partial<DiscoveryMixConfig>;
  const intlRaw =
    typeof v.intl_cap_pct === "number" || typeof v.intl_cap_pct === "string"
      ? Number(v.intl_cap_pct)
      : d.intl_cap_pct;
  return {
    core_pct: clampPct(v.core_pct, d.core_pct),
    explore_pct: clampPct(v.explore_pct, d.explore_pct),
    neutral_pct: clampPct(v.neutral_pct, d.neutral_pct),
    city_pct: clampPct(v.city_pct, d.city_pct),
    country_within_core_pct: clampPct(v.country_within_core_pct, d.country_within_core_pct),
    rotation_hours: Math.min(168, Math.max(1, clampPct(v.rotation_hours, d.rotation_hours) || d.rotation_hours)),
    // Soft feature: absent → 10; clamp 0–25
    intl_cap_pct: Math.min(25, Math.max(0, Number.isFinite(intlRaw) ? Math.round(intlRaw) : d.intl_cap_pct)),
  };
}

/** Sum of core+explore+neutral; warn UI if not ~100. */
export function discoveryMixSum(m: DiscoveryMixConfig): number {
  return m.core_pct + m.explore_pct + m.neutral_pct;
}

function normalizeAuthSettings(raw: unknown): AuthSettings {
  if (!raw || typeof raw !== "object") return { ...AUTH_SETTINGS_DEFAULTS, discovery_mix: { ...DISCOVERY_MIX_DEFAULTS } };
  const v = raw as Partial<AuthSettings> & {
    discovery_onboarding_steps?: Partial<AuthSettings["discovery_onboarding_steps"]>;
    discovery_mix?: Partial<DiscoveryMixConfig>;
  };
  return {
    mode: v.mode === "strict" ? "strict" : "fluid",
    collect_phone_on_signup: v.collect_phone_on_signup !== false,
    address_onboarding_enabled: v.address_onboarding_enabled !== false,
    gate_checkout_on_email_confirm: v.gate_checkout_on_email_confirm === true,
    discovery_onboarding_enabled: v.discovery_onboarding_enabled !== false,
    discovery_onboarding_steps: {
      payment: v.discovery_onboarding_steps?.payment !== false,
      receipt: v.discovery_onboarding_steps?.receipt !== false,
    },
    discovery_mix: normalizeDiscoveryMix(v.discovery_mix),
    discovery_popup_delay_sec: Math.min(
      120,
      Math.max(0, typeof v.discovery_popup_delay_sec === "number" ? v.discovery_popup_delay_sec : 15),
    ),
  };
}

export function useAuthSettings() {
  return useQuery({
    queryKey: AUTH_SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<AuthSettings> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "auth_settings")
        .maybeSingle();
      if (error) {
        console.warn("[useAuthSettings]", error.message);
        return { ...AUTH_SETTINGS_DEFAULTS, discovery_mix: { ...DISCOVERY_MIX_DEFAULTS } };
      }
      return normalizeAuthSettings(data?.value);
    },
    staleTime: 60_000,
  });
}

export { normalizeAuthSettings };
