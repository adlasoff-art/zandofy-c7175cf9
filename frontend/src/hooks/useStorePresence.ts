import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sends heartbeat every 60s to mark store as online.
 * Now derives store online status from member presence (owner + collaborators).
 * Sets store offline on unmount / tab close.
 */
export function useStorePresence(storeId: string | null | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!storeId) return;

    const heartbeat = async () => {
      (supabase.rpc as any)("update_store_presence", { p_store_id: storeId }).then(({ error }: any) => {
        if (error) console.warn("Presence heartbeat error:", error.message);
      });
    };

    const goOffline = () => {
      (supabase.rpc as any)("set_store_offline", { p_store_id: storeId });
    };

    heartbeat();
    intervalRef.current = setInterval(heartbeat, 60_000);
    window.addEventListener("beforeunload", goOffline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", goOffline);
      goOffline();
    };
  }, [storeId]);
}

/**
 * Auto-detects all stores the current user is a member of (owner or collaborator)
 * and sends presence heartbeats for all of them.
 */
export function useAutoStorePresence() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storeIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchStores = async () => {
      // Get owned stores
      const { data: owned } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id);

      // Get collaborator stores
      const { data: collabs } = await (supabase as any)
        .from("store_collaborators")
        .select("store_id")
        .eq("user_id", user.id)
        .eq("status", "active");

      const ids = new Set<string>();
      (owned ?? []).forEach((s: any) => ids.add(s.id));
      (collabs ?? []).forEach((s: any) => ids.add(s.store_id));
      storeIdsRef.current = Array.from(ids);
    };

    const heartbeatAll = async () => {
      for (const sid of storeIdsRef.current) {
        (supabase.rpc as any)("update_store_presence", { p_store_id: sid }).catch(() => {});
      }
    };

    const goOfflineAll = () => {
      for (const sid of storeIdsRef.current) {
        (supabase.rpc as any)("set_store_offline", { p_store_id: sid }).catch(() => {});
      }
    };

    // Initial fetch + heartbeat
    fetchStores().then(heartbeatAll);

    // Refresh every 60s
    intervalRef.current = setInterval(heartbeatAll, 60_000);
    window.addEventListener("beforeunload", goOfflineAll);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", goOfflineAll);
      goOfflineAll();
    };
  }, [user?.id]);
}
