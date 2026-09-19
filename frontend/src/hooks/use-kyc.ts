import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type KycStatus = "not_started" | "pending" | "approved" | "rejected" | "resubmission_required";

export interface KycVerification {
  id: string;
  user_id: string;
  status: KycStatus;
  document_type: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string;
  address_country: string;
  address_city: string;
  address_street: string;
  address_district: string | null;
  address_postal_code: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KycSettings {
  kyc_activation_orders: number;
  kyc_order_limit: number;
  kyc_reminder_days: number;
}

const DEFAULT_KYC_SETTINGS: KycSettings = {
  kyc_activation_orders: 2,
  kyc_order_limit: 10,
  kyc_reminder_days: 7,
};

export function useKycStatus() {
  const { user } = useAuth();

  const { data: kycVerification, isLoading: loadingKyc, isFetched: kycFetched, isError: kycError, refetch: refetchKyc } = useQuery({
    queryKey: ["kyc-verification", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from("kyc_verifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as KycVerification | null);
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const {
    data: orderCount = 0,
    isFetched: orderCountFetched,
    isError: orderCountError,
  } = useQuery({
    queryKey: ["user-order-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("status", "in", '("cancelled","returned")');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: kycSettings = DEFAULT_KYC_SETTINGS, isFetched: kycSettingsFetched } = useQuery({
    queryKey: ["kyc-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "kyc_settings")
        .maybeSingle();
      if (data?.value && typeof data.value === "object") {
        return { ...DEFAULT_KYC_SETTINGS, ...(data.value as Record<string, number>) };
      }
      return DEFAULT_KYC_SETTINGS;
    },
    staleTime: 300_000,
  });

  const kycStatus: KycStatus = kycVerification?.status ?? "not_started";
  const isVerified = kycStatus === "approved";
  const isPending = kycStatus === "pending";
  const needsKyc = orderCount >= kycSettings.kyc_activation_orders && !isVerified;
  const isOrderBlocked = !isVerified && orderCount >= kycSettings.kyc_order_limit;
  const canResubmit = kycStatus === "rejected" || kycStatus === "resubmission_required";
  // Ready only when verification + order count + settings settled (no flash with wrong defaults).
  // On KYC doc OR order-count fetch error: fail-open (do not trap checkout on a blip).
  // orderCount query throws on error so React Query retries before settling as isError.
  const isKycReady =
    !user ||
    (orderCountFetched &&
      kycSettingsFetched &&
      (kycError || orderCountError || (kycFetched && !loadingKyc)));

  return {
    kycVerification,
    kycStatus,
    isVerified,
    isPending,
    needsKyc,
    isOrderBlocked: kycError || orderCountError ? false : isOrderBlocked,
    canResubmit,
    orderCount,
    kycSettings,
    loadingKyc,
    isKycReady,
    refetchKyc,
  };
}
