import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sends heartbeat every 60s to mark user as online.
 * Sets user offline on unmount / tab close.
 */
export function useUserPresence() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;

    const heartbeat = () => {
      (supabase.rpc as any)("update_user_presence", { p_user_id: userId }).then(({ error }: any) => {
        if (error) console.warn("User presence heartbeat error:", error.message);
      });
    };

    const goOffline = () => {
      (supabase.rpc as any)("set_user_offline", { p_user_id: userId });
    };

    heartbeat();
    intervalRef.current = setInterval(heartbeat, 60_000);
    window.addEventListener("beforeunload", goOffline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", goOffline);
      goOffline();
    };
  }, [user?.id]);
}
