/**
 * useForwarderContext — loads forwarder for owner, linked transporter, or active member.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";

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
  wa_templates?: Record<string, string> | null;
}

export type ForwarderMemberRole = "owner" | "ops" | "finance" | null;

export function useForwarderContext() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["forwarder-context", user?.id],
    enabled: !!user?.id && !authLoading,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ forwarder: ForwarderRow | null; memberRole: ForwarderMemberRole }> => {
      // 1) Owner or linked transporter
      const { data: owned, error } = await fromTable("forwarders")
        .select("*")
        .or(`owner_user_id.eq.${user!.id},linked_transporter_user_id.eq.${user!.id}`)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("[useForwarderContext] fetch failed:", error.message);
      }
      if (owned) {
        const role: ForwarderMemberRole =
          (owned as ForwarderRow).owner_user_id === user!.id ? "owner" : "ops";
        return { forwarder: owned as ForwarderRow, memberRole: role };
      }

      // 2) Active staff member
      const { data: membership } = await (supabase as any)
        .from("forwarder_members")
        .select("role, forwarder_id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!membership?.forwarder_id) {
        return { forwarder: null, memberRole: null };
      }

      const { data: fw } = await fromTable("forwarders")
        .select("*")
        .eq("id", membership.forwarder_id)
        .maybeSingle();

      return {
        forwarder: (fw as ForwarderRow | null) ?? null,
        memberRole: (membership.role as ForwarderMemberRole) || "ops",
      };
    },
  });

  const forwarder = query.data?.forwarder ?? null;
  const memberRole = query.data?.memberRole ?? null;
  const isOwner =
    !!forwarder && (forwarder.owner_user_id === user?.id || memberRole === "owner");
  const canFinance =
    isOwner || memberRole === "finance" || memberRole === "owner";

  return {
    forwarder,
    memberRole,
    canFinance,
    loading: authLoading || query.isLoading,
    isOwner,
    isApproved: forwarder?.status === "approved" && forwarder?.is_active === true,
    isPending: forwarder?.status === "pending",
    isRejected: forwarder?.status === "rejected",
    isSuspended: forwarder?.status === "suspended",
    refetch: query.refetch,
  };
}
