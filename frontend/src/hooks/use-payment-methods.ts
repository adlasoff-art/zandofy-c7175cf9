/**
 * Hook to fetch enabled/disabled payment methods from platform_settings.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentMethodsConfig {
  mobile_money: boolean;
  stripe: boolean;
  cod: boolean;
  stripe_notice_enabled?: boolean;
  stripe_notice_text?: string;
}

const DEFAULT_CONFIG: PaymentMethodsConfig = {
  mobile_money: true,
  stripe: true,
  cod: true,
  stripe_notice_enabled: false,
  stripe_notice_text: "Pour l'instant, ce moyen de paiement n'est pas actif.",
};

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods-config"],
    queryFn: async (): Promise<PaymentMethodsConfig> => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "payment_methods")
        .single();
      if (data?.value && typeof data.value === "object") {
        return { ...DEFAULT_CONFIG, ...(data.value as Record<string, boolean>) };
      }
      return DEFAULT_CONFIG;
    },
    staleTime: 60_000,
  });
}
