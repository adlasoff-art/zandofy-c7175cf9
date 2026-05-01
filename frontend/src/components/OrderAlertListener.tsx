import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { playOrderAlertSound } from "@/lib/notification-sounds";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { useVisibilityAwareInterval } from "@/hooks/use-visibility-aware-interval";

/**
 * Polls for new orders and plays a distinct alert sound
 * for admin, manager, and vendor roles.
 * (Replaced Realtime subscription for security — no table in publication)
 */
export function OrderAlertListener() {
  const { user } = useAuth();
  const { isAdmin, isManager, isVendor, loading } = useRoles();
  const storeIdsRef = useRef<string[]>([]);
  const lastSeenRef = useRef<string>(new Date().toISOString());

  // For vendors, fetch their store IDs
  useEffect(() => {
    if (!user || !isVendor) {
      storeIdsRef.current = [];
      return;
    }
    supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .then(({ data }) => {
        storeIdsRef.current = (data || []).map((s: any) => s.id);
      });
  }, [user, isVendor]);

  const enabled = !!user && !loading && (isAdmin || isManager || isVendor);

  const checkNewOrders = async () => {
    if (!enabled) return;
    // Un vendeur sans store n'a rien à interroger : on évite un scan inutile.
    const isVendorOnly = isVendor && !isAdmin && !isManager;
    if (isVendorOnly && storeIdsRef.current.length === 0) return;

    let query = supabase
      .from("orders")
      .select("order_ref, store_id, total, created_at")
      .gt("created_at", lastSeenRef.current)
      .order("created_at", { ascending: true })
      .limit(20);

    if (isVendorOnly) {
      query = query.in("store_id", storeIdsRef.current);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      playOrderAlertSound();
      const latest = data[data.length - 1] as any;
      toast("🛒 Nouvelle commande !", {
        description: `Réf: ${latest.order_ref} — $${latest.total}`,
        icon: <ShoppingBag size={16} />,
        duration: 8000,
      });
      lastSeenRef.current = new Date().toISOString();
    }
  };

  // Polling adaptatif (30s focus / 90s hidden) au lieu de 15s constants.
  useVisibilityAwareInterval(checkNewOrders, {
    activeMs: 30_000,
    hiddenMs: 90_000,
    enabled,
    runImmediately: false,
  } as any);

  return null;
}
