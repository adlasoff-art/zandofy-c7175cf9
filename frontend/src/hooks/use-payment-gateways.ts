import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizePaymentGateways,
  PAYMENT_GATEWAYS_DEFAULTS,
  type PaymentGatewaysConfig,
} from "@/lib/payment-gateways";

export const PAYMENT_GATEWAYS_QUERY_KEY = ["platform-payment-gateways"] as const;

export function usePaymentGateways() {
  return useQuery({
    queryKey: PAYMENT_GATEWAYS_QUERY_KEY,
    queryFn: async (): Promise<PaymentGatewaysConfig> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "payment_gateways")
        .maybeSingle();
      if (error) {
        console.warn("[payment_gateways]", error.message);
        return {
          ...PAYMENT_GATEWAYS_DEFAULTS,
          by_country: { ...PAYMENT_GATEWAYS_DEFAULTS.by_country },
          pawapay: { ...PAYMENT_GATEWAYS_DEFAULTS.pawapay },
        };
      }
      return normalizePaymentGateways(data?.value);
    },
    staleTime: 5 * 60 * 1000,
  });
}
