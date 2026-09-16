import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StoreSuspensionStatus {
  is_suspended: boolean;
  is_banned: boolean;
  /** Soft-archive: when set, treat like ban for write guards */
  deleted_at: string | null;
  suspension_reason: string | null;
  ban_reason: string | null;
  delete_reason: string | null;
  suspended_activities: string[];
}

export function useStoreSuspension(storeId: string | undefined | null) {
  return useQuery({
    queryKey: ["store-suspension", storeId],
    queryFn: async (): Promise<StoreSuspensionStatus | null> => {
      if (!storeId) return null;
      const { data, error } = await (supabase as any)
        .from("stores")
        .select(
          "is_suspended, is_banned, deleted_at, suspension_reason, ban_reason, delete_reason, suspended_activities"
        )
        .eq("id", storeId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        ...data,
        deleted_at: data.deleted_at ?? null,
        delete_reason: data.delete_reason ?? null,
        suspended_activities: data.suspended_activities || [],
      };
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });
}

/** Check if a specific activity is blocked for a store */
export function isActivityBlocked(
  status: StoreSuspensionStatus | null | undefined,
  activity: "sales" | "messaging" | "product_listing" | "withdrawals" | "promotions"
): boolean {
  if (!status) return false;
  // Soft-archive and ban: all vendor write activities blocked
  if (status.is_banned || status.deleted_at) return true;
  if (!status.is_suspended) return false;
  // If no specific activities listed, ALL are blocked
  if (status.suspended_activities.length === 0) return true;
  return status.suspended_activities.includes(activity);
}
