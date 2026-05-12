/**
 * useForwarderContext — Affinage UX /forwarder/* (Phase B2.2)
 *
 * Charge le forwarder (transitaire) dont le user connecté est owner ou
 * transporteur lié. Cache 5min. Utilisé par tout le dashboard /forwarder/*
 * et le RoleGuard.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fromTable } from "@/lib/supabase-helpers";

export interface ForwarderRow {
  id: string;
  owner_user_id: string | null;
  linked_transporter_user_id: string | null;
  name: string;
  slug: string;
  legal_name: string | null;
  registration_number: string | null;
  tax_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  description: string | null;
  logo_url: string | null;
  headquarters_country: string | null;
  headquarters_city: string | null;
  headquarters_address: string | null;
  supported_modes: string[] | null;
  coverage_routes: any;
  estimated_monthly_volume_kg: number | null;
  documents: any;
  is_active: boolean;
  is_platform_owned: boolean;
  status: "pending" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useForwarderContext() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["forwarder-context", user?.id],
    enabled: !!user?.id && !authLoading,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ForwarderRow | null> => {
      // Match owner OR linked transporter
      const { data, error } = await fromTable("forwarders")
        .select("*")
        .or(`owner_user_id.eq.${user!.id},linked_transporter_user_id.eq.${user!.id}`)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("[useForwarderContext] fetch failed:", error.message);
        return null;
      }
      return (data as ForwarderRow | null) ?? null;
    },
  });

  const forwarder = query.data ?? null;

  return {
    forwarder,
    loading: authLoading || query.isLoading,
    isOwner: !!forwarder,
    isApproved: forwarder?.status === "approved" && forwarder?.is_active === true,
    isPending: forwarder?.status === "pending",
    isRejected: forwarder?.status === "rejected",
    isSuspended: forwarder?.status === "suspended",
    refetch: query.refetch,
  };
}