import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { playOrderAlertSound } from "@/lib/notification-sounds";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";

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

  useEffect(() => {
    if (!user || loading) return;
    if (!isAdmin && !isManager && !isVendor) return;

    const checkNewOrders = async () => {
      let query = supabase
        .from("orders")
        .select("order_ref, store_id, total")
        .gt("created_at", lastSeenRef.current)
        .order("created_at", { ascending: true });

      // Vendors only see their own store's orders
      if (isVendor && !isAdmin && !isManager && storeIdsRef.current.length > 0) {
        query = query.in("store_id", storeIdsRef.current);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        playOrderAlertSound();
        // Show toast for the latest order
        const latest = data[data.length - 1] as any;
        toast("🛒 Nouvelle commande !", {
          description: `Réf: ${latest.order_ref} — $${latest.total}`,
          icon: <ShoppingBag size={16} />,
          duration: 8000,
        });
        // Update cursor to latest order
        lastSeenRef.current = new Date().toISOString();
      }
    };

    // Poll every 15s
    const interval = setInterval(checkNewOrders, 15000);
    return () => clearInterval(interval);
  }, [user, loading, isAdmin, isManager, isVendor]);

  return null;
}
