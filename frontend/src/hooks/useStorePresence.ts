import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sends heartbeat every 60s to mark store as online.
 * Sets store offline on unmount / tab close.
 */
export function useStorePresence(storeId: string | null | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!storeId) return;

    // Check if presence is visible before sending heartbeat
    const heartbeat = async () => {
      const { data } = await (supabase as any)
        .from("stores")
        .select("presence_visible")
        .eq("id", storeId)
        .single();

      if (data?.presence_visible === false) return;

      (supabase.rpc as any)("update_store_presence", { p_store_id: storeId }).then(({ error }: any) => {
        if (error) console.warn("Presence heartbeat error:", error.message);
      });
    };

    const goOffline = () => {
      (supabase.rpc as any)("set_store_offline", { p_store_id: storeId });
    };

    // Initial heartbeat
    heartbeat();

    // Interval every 60s
    intervalRef.current = setInterval(heartbeat, 60_000);

    // Offline on tab close
    window.addEventListener("beforeunload", goOffline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", goOffline);
      goOffline();
    };
  }, [storeId]);
}
