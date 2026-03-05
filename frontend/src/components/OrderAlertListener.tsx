import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { playOrderAlertSound } from "@/lib/notification-sounds";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";

/**
 * Listens for new orders via Realtime and plays a distinct alert sound
 * for admin, manager, and vendor roles.
 */
export function OrderAlertListener() {
  const { user } = useAuth();
  const { isAdmin, isManager, isVendor, loading } = useRoles();
  const storeIdsRef = useRef<string[]>([]);

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

    const channel = supabase
      .channel("order-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as { order_ref: string; store_id: string | null; total: number };

          // Vendors only hear their own store's orders
          if (isVendor && !isAdmin && !isManager) {
            if (!order.store_id || !storeIdsRef.current.includes(order.store_id)) return;
          }

          playOrderAlertSound();

          toast("🛒 Nouvelle commande !", {
            description: `Réf: ${order.order_ref} — $${order.total}`,
            icon: <ShoppingBag size={16} />,
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loading, isAdmin, isManager, isVendor]);

  return null;
}
