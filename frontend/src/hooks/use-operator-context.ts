/**
 * useOperatorContext — Lot 11B Phase B2
 *
 * Charge l'opérateur (entreprise de livraison) dont le user connecté est owner.
 * Cache 5min. Utilisé par tout le dashboard /operator/* et le RoleGuard.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fromTable } from "@/lib/supabase-helpers";

export interface OperatorRow {
  id: string;
  owner_user_id: string;
  company_name: string;
  legal_name: string | null;
  registration_number: string | null;
  tax_id: string | null;
  contact_email: string;
  contact_phone: string;
  headquarters_country: string;
  headquarters_city: string;
  headquarters_address: string | null;
  logo_url: string | null;
  vehicle_types: Array<{ type: string; count: number }>;
  declared_riders_count: number;
  max_riders: number;
  platform_commission_pct: number;
  is_platform_owned: boolean;
  is_active: boolean;
  status: "pending" | "approved" | "suspended" | "rejected";
  rating_avg: number | null;
  total_deliveries: number;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useOperatorContext() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["operator-context", user?.id],
    enabled: !!user?.id && !authLoading,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OperatorRow | null> => {
      const { data, error } = await fromTable("delivery_operators")
        .select("*")
        .eq("owner_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("[useOperatorContext] fetch failed:", error.message);
        return null;
      }
      return (data as OperatorRow | null) ?? null;
    },
  });

  const operator = query.data ?? null;

  return {
    operator,
    loading: authLoading || query.isLoading,
    isOwner: !!operator,
    isApproved: operator?.status === "approved" && operator?.is_active === true,
    isPending: operator?.status === "pending",
    isRejected: operator?.status === "rejected",
    isSuspended: operator?.status === "suspended",
    refetch: query.refetch,
  };
}