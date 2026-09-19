import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AuthSettings = {
  mode: "fluid" | "strict";
  collect_phone_on_signup: boolean;
  address_onboarding_enabled: boolean;
  gate_checkout_on_email_confirm: boolean;
};

export const AUTH_SETTINGS_DEFAULTS: AuthSettings = {
  mode: "fluid",
  collect_phone_on_signup: true,
  address_onboarding_enabled: true,
  gate_checkout_on_email_confirm: false,
};

export const AUTH_SETTINGS_QUERY_KEY = ["platform-auth-settings"] as const;

function normalizeAuthSettings(raw: unknown): AuthSettings {
  if (!raw || typeof raw !== "object") return { ...AUTH_SETTINGS_DEFAULTS };
  const v = raw as Partial<AuthSettings>;
  return {
    mode: v.mode === "strict" ? "strict" : "fluid",
    collect_phone_on_signup: v.collect_phone_on_signup !== false,
    address_onboarding_enabled: v.address_onboarding_enabled !== false,
    gate_checkout_on_email_confirm: v.gate_checkout_on_email_confirm === true,
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
      // RLS miss / network: fall back to product defaults (do not break signup)
      if (error) {
        console.warn("[useAuthSettings]", error.message);
        return { ...AUTH_SETTINGS_DEFAULTS };
      }
      return normalizeAuthSettings(data?.value);
    },
    staleTime: 60_000,
  });
}
