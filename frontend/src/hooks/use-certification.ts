import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useKycStatus } from "@/hooks/use-kyc";
import { toast } from "sonner";

export function useCertification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isVerified: kycApproved } = useKycStatus();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-certification", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, is_certified")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase
        .from("profiles")
        .update({ is_certified: enabled } as any)
        .eq("id", user.id);
      if (error) throw error;
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ["profile-certification", user?.id] });
      const prev = queryClient.getQueryData(["profile-certification", user?.id]);
      queryClient.setQueryData(["profile-certification", user?.id], (old: any) => ({
        ...old,
        is_certified: enabled,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["profile-certification", user?.id], ctx?.prev);
      toast.error("Vérification KYC requise pour activer la certification");
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? "Badge de certification activé" : "Badge de certification désactivé");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-certification", user?.id] });
    },
  });

  return {
    isCertified: !!(profile as any)?.is_certified,
    canCertify: kycApproved,
    isLoading,
    toggleCertification: (enabled: boolean) => toggleMutation.mutate(enabled),
    isToggling: toggleMutation.isPending,
  };
}

/** Hook for store certification (vendor) */
export function useStoreCertification(storeId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: store, isLoading } = useQuery({
    queryKey: ["store-certification", storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data } = await supabase
        .from("stores")
        .select("id, is_certified, owner_id")
        .eq("id", storeId)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!storeId) throw new Error("Boutique non trouvée");
      const { error } = await supabase
        .from("stores")
        .update({ is_certified: enabled } as any)
        .eq("id", storeId);
      if (error) throw error;
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ["store-certification", storeId] });
      const prev = queryClient.getQueryData(["store-certification", storeId]);
      queryClient.setQueryData(["store-certification", storeId], (old: any) => ({
        ...old,
        is_certified: enabled,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["store-certification", storeId], ctx?.prev);
      toast.error("Vérification KYC du propriétaire requise pour activer la certification");
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? "Badge boutique certifiée activé" : "Badge boutique certifiée désactivé");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["store-certification", storeId] });
    },
  });

  return {
    isCertified: !!(store as any)?.is_certified,
    isLoading,
    toggleCertification: (enabled: boolean) => toggleMutation.mutate(enabled),
    isToggling: toggleMutation.isPending,
  };
}
