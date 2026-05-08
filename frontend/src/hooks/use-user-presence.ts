import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVisibilityAwareInterval } from "@/hooks/use-visibility-aware-interval";

/**
 * Heartbeat de présence utilisateur.
 *
 * Lot 18C : passe de 60 s sans interruption à 120 s focus / pause si onglet caché,
 * ce qui divise par ~4 le nombre de RPC `update_user_presence` (10 % du temps DB en prod).
 * Le seuil "user en ligne" passe en parallèle de 2 min à 5 min côté lecture.
 */
export function useUserPresence() {
  const { user } = useAuth();
  const userId = user?.id;

  const heartbeat = useCallback(() => {
    if (!userId) return;
    (supabase.rpc as any)("update_user_presence", { p_user_id: userId }).then(
      ({ error }: any) => {
        if (error) console.warn("User presence heartbeat error:", error.message);
      }
    );
  }, [userId]);

  useVisibilityAwareInterval(heartbeat, {
    activeMs: 120_000,
    hiddenMs: 0, // pas de heartbeat quand l'onglet est caché
    enabled: !!userId,
  });

  // Marque offline à la fermeture de l'onglet et au démontage.
  useEffect(() => {
    if (!userId) return;
    const goOffline = () => {
      (supabase.rpc as any)("set_user_offline", { p_user_id: userId });
    };
    window.addEventListener("beforeunload", goOffline);
    return () => {
      window.removeEventListener("beforeunload", goOffline);
      goOffline();
    };
  }, [userId]);
}
