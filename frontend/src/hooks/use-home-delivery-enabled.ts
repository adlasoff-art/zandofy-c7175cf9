/**
 * Platform kill-switch for last-mile home delivery.
 * Default false when the setting is missing (safer for conversion).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const HOME_DELIVERY_ENABLED_QUERY_KEY = ["platform-home-delivery-enabled"] as const;

export function useHomeDeliveryEnabled() {
  return useQuery({
    queryKey: HOME_DELIVERY_ENABLED_QUERY_KEY,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "home_delivery_enabled")
        .maybeSingle();
      if (error) throw error;
      if (!data?.value || typeof data.value !== "object") return false;
      return (data.value as { enabled?: boolean }).enabled === true;
    },
    staleTime: 60_000,
  });
}
