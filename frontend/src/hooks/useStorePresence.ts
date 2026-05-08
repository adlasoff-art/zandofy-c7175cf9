import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVisibilityAwareInterval } from "@/hooks/use-visibility-aware-interval";

/**
 * Heartbeat de présence pour un magasin donné.
 *
 * Lot 18C : 60 s permanent → 120 s focus / pause si onglet caché.
 * Réduit ~75 % des RPC `update_store_presence` (≈6 % du temps DB en prod).
 * Le seuil "magasin en ligne" passe en parallèle à 5 min côté lecture.
 */
export function useStorePresence(storeId: string | null | undefined) {
  const heartbeat = useCallback(() => {
    if (!storeId) return;
    (supabase.rpc as any)("update_store_presence", { p_store_id: storeId }).then(
      ({ error }: any) => {
        if (error) console.warn("Presence heartbeat error:", error.message);
      }
    );
  }, [storeId]);

  useVisibilityAwareInterval(heartbeat, {
    activeMs: 120_000,
    hiddenMs: 0,
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!storeId) return;
    const goOffline = () => {
      (supabase.rpc as any)("set_store_offline", { p_store_id: storeId });
    };
    window.addEventListener("beforeunload", goOffline);
    return () => {
      window.removeEventListener("beforeunload", goOffline);
      goOffline();
    };
  }, [storeId]);
}

/**
 * Auto-détecte tous les magasins dont l'utilisateur courant est membre
 * (propriétaire ou collaborateur actif) et envoie un heartbeat groupé.
 *
 * Idem : 120 s focus / pause si caché.
 */
export function useAutoStorePresence() {
  const { user } = useAuth();
  const storeIdsRef = useRef<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      storeIdsRef.current = [];
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: owned }, { data: collabs }] = await Promise.all([
        supabase.from("stores").select("id").eq("owner_id", user.id),
        (supabase as any)
          .from("store_collaborators")
          .select("store_id")
          .eq("user_id", user.id)
          .eq("status", "active"),
      ]);
      if (cancelled) return;
      const ids = new Set<string>();
      (owned ?? []).forEach((s: any) => ids.add(s.id));
      (collabs ?? []).forEach((s: any) => ids.add(s.store_id));
      storeIdsRef.current = Array.from(ids);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const heartbeatAll = useCallback(async () => {
    for (const sid of storeIdsRef.current) {
      try {
        await (supabase.rpc as any)("update_store_presence", { p_store_id: sid });
      } catch {
        /* swallow */
      }
    }
  }, []);

  useVisibilityAwareInterval(heartbeatAll, {
    activeMs: 120_000,
    hiddenMs: 0,
    enabled: !!user?.id && ready,
  });

  useEffect(() => {
    if (!user?.id) return;
    const goOfflineAll = () => {
      for (const sid of storeIdsRef.current) {
        try {
          (supabase.rpc as any)("set_store_offline", { p_store_id: sid });
        } catch {
          /* swallow */
        }
      }
    };
    window.addEventListener("beforeunload", goOfflineAll);
    return () => {
      window.removeEventListener("beforeunload", goOfflineAll);
      goOfflineAll();
    };
  }, [user?.id]);
}
