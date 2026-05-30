import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { playOrderAlertSound } from "@/lib/notification-sounds";
import { toast } from "sonner";
import { ShoppingBag, CreditCard, ShieldCheck } from "lucide-react";
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
  const lastSeenOffPlatformProofRef = useRef<string>(new Date().toISOString());
  const lastSeenVendorVerifyRef = useRef<string>(new Date().toISOString());

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
      .select("order_ref, store_id, total, created_at, status")
      .gt("created_at", lastSeenRef.current)
      // Ne JAMAIS alerter pour une commande encore en attente de paiement (carte/MM/PayPal/Stripe/off-platform)
      // ni pour les commandes échouées/annulées/retournées. Seules les commandes payées et actives doivent
      // déclencher l'alerte "Nouvelle commande !".
      .not("status", "in", '("awaiting_payment","payment_failed","cancelled","returned")')
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

  const checkOffPlatformProofForVendor = async () => {
    if (!enabled || !isVendor) return;
    const isVendorOnly = isVendor && !isAdmin && !isManager;
    if (!isVendorOnly || storeIdsRef.current.length === 0) return;

    const { data } = await supabase
      .from("orders")
      .select("order_ref, updated_at")
      .in("store_id", storeIdsRef.current)
      .eq("payment_method", "off_platform")
      .eq("status", "awaiting_payment")
      .not("shipping_payment_proof_url", "is", null)
      .is("off_platform_vendor_verified_at", null)
      .gt("updated_at", lastSeenOffPlatformProofRef.current)
      .order("updated_at", { ascending: true })
      .limit(10);

    if (data && data.length > 0) {
      const latest = data[data.length - 1] as any;
      toast("Preuve hors plateforme à vérifier", {
        description: `Commande ${latest.order_ref}`,
        icon: <CreditCard size={16} />,
        duration: 8000,
      });
      lastSeenOffPlatformProofRef.current = new Date().toISOString();
    }
  };

  const checkOffPlatformReadyForAdmin = async () => {
    if (!enabled || (!isAdmin && !isManager)) return;

    const { data } = await supabase
      .from("orders")
      .select("order_ref, off_platform_vendor_verified_at")
      .eq("payment_method", "off_platform")
      .eq("status", "awaiting_payment")
      .not("off_platform_vendor_verified_at", "is", null)
      .is("off_platform_admin_released_at", null)
      .gt("off_platform_vendor_verified_at", lastSeenVendorVerifyRef.current)
      .order("off_platform_vendor_verified_at", { ascending: true })
      .limit(10);

    if (data && data.length > 0) {
      const latest = data[data.length - 1] as any;
      toast("Hors plateforme prête à libérer", {
        description: `Commande ${latest.order_ref} — validation vendeur reçue`,
        icon: <ShieldCheck size={16} />,
        duration: 8000,
      });
      lastSeenVendorVerifyRef.current = new Date().toISOString();
    }
  };

  const runAllChecks = async () => {
    await checkNewOrders();
    await checkOffPlatformProofForVendor();
    await checkOffPlatformReadyForAdmin();
  };

  // Polling adaptatif (30s focus / 90s hidden) au lieu de 15s constants.
  useVisibilityAwareInterval(runAllChecks, {
    activeMs: 30_000,
    hiddenMs: 90_000,
    enabled,
    runImmediately: false,
  } as any);

  return null;
}
