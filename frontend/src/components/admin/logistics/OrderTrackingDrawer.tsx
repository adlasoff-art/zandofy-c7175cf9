import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DeliveryMap, type MapMarker } from "@/components/DeliveryMap";
import { Bike, MapPin, Phone, ExternalLink, CheckCircle2, Clock, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface OrderTrackingDrawerProps {
  delivery: any | null;
  onClose: () => void;
}

const STATUS_TIMELINE = [
  { key: "pending", label: "En attente", icon: Clock },
  { key: "in_progress", label: "En cours", icon: Truck },
  { key: "delivered", label: "Livré", icon: CheckCircle2 },
];

export function OrderTrackingDrawer({ delivery, onClose }: OrderTrackingDrawerProps) {
  const open = !!delivery;
  const deliveryId = delivery?.id;
  const orderId = delivery?.order_id ?? null;
  const riderId = delivery?.rider_id ?? null;

  // Live rider position
  const { data: riderLoc } = useQuery({
    queryKey: ["order-tracking-rider", riderId],
    queryFn: async () => {
      if (!riderId) return null;
      const { data } = await (supabase as any)
        .from("rider_locations")
        .select("latitude, longitude, heading, speed, updated_at")
        .eq("rider_id", riderId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!riderId,
    refetchInterval: 8000,
  });

  // Live customer position
  const { data: customerLoc } = useQuery({
    queryKey: ["order-tracking-customer", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await (supabase as any)
        .from("customer_locations")
        .select("latitude, longitude, updated_at, user_id")
        .eq("order_id", orderId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!orderId,
    refetchInterval: 10000,
  });

  // Order details for status timeline
  const { data: order } = useQuery({
    queryKey: ["order-tracking-order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data } = await supabase
        .from("orders")
        .select("id, order_ref, status, user_id, created_at, total, shipping_address, shipping_city")
        .eq("id", orderId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!orderId,
  });

  // Rider profile for label
  const { data: riderProfile } = useQuery({
    queryKey: ["order-tracking-rider-profile", riderId],
    queryFn: async () => {
      if (!riderId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone")
        .eq("id", riderId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!riderId,
  });

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (riderLoc?.latitude && riderLoc?.longitude) {
      m.push({
        lat: Number(riderLoc.latitude),
        lng: Number(riderLoc.longitude),
        type: "rider",
        label: `🚴 ${riderProfile?.first_name ?? "Livreur"}`,
        id: `rider-${riderId}`,
      });
    }
    if (customerLoc?.latitude && customerLoc?.longitude) {
      m.push({
        lat: Number(customerLoc.latitude),
        lng: Number(customerLoc.longitude),
        type: "customer",
        label: `📍 ${delivery?.customer_name ?? "Client"}`,
        id: `customer-${orderId}`,
      });
    }
    return m;
  }, [riderLoc, customerLoc, riderProfile, riderId, orderId, delivery?.customer_name]);

  const sendGps = async (type: "rider" | "customer") => {
    let userId = type === "rider" ? riderId : null;
    if (type === "customer" && orderId) {
      const { data: ord } = await supabase.from("orders").select("user_id").eq("id", orderId).single();
      userId = ord?.user_id ?? null;
    }
    if (!userId) {
      toast.error("Utilisateur introuvable");
      return;
    }
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      type: "delivery",
      title: "Activez votre GPS",
      message:
        type === "rider"
          ? "L'administrateur demande l'activation de votre GPS pour le suivi en temps réel."
          : "Activez votre GPS pour permettre le suivi de votre livraison.",
      link: type === "rider" ? "/rider" : "/tracking",
    });
    if (error) toast.error(error.message);
    else toast.success("Notification GPS envoyée");
  };

  const currentStatus = delivery?.status ?? "pending";
  const currentIdx = STATUS_TIMELINE.findIndex((s) => s.key === currentStatus);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bike size={18} className="text-primary" />
            Suivi commande {delivery?.order_ref || (delivery?.id?.slice(0, 8) ?? "")}
          </SheetTitle>
          <SheetDescription>
            {delivery?.customer_name} · {delivery?.address}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Filtered map */}
          <div className="rounded-xl overflow-hidden border border-border">
            {markers.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center bg-muted/30 text-muted-foreground text-sm gap-2">
                <Loader2 className="animate-spin" size={16} /> En attente des positions GPS…
              </div>
            ) : (
              <DeliveryMap markers={markers} showPolylines showEta className="h-[280px]" />
            )}
          </div>

          {/* GPS controls */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => sendGps("rider")}
              disabled={!riderId}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted/40 disabled:opacity-40"
            >
              <MapPin size={12} />
              {riderLoc ? "GPS livreur OK" : "Demander GPS livreur"}
            </button>
            <button
              onClick={() => sendGps("customer")}
              disabled={!orderId}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted/40 disabled:opacity-40"
            >
              <MapPin size={12} />
              {customerLoc ? "GPS client OK" : "Demander GPS client"}
            </button>
          </div>

          {/* Status timeline */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-foreground mb-3">Statut</h3>
            <div className="flex items-center justify-between">
              {STATUS_TIMELINE.map((s, i) => {
                const reached = currentIdx >= i;
                const Icon = s.icon;
                return (
                  <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon size={14} />
                    </div>
                    <span className={`text-[10px] ${reached ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer + rider info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Client</p>
              <p className="text-sm font-medium text-foreground">{delivery?.customer_name}</p>
              {delivery?.customer_phone && (
                <a href={`tel:${delivery.customer_phone}`} className="flex items-center gap-1 text-xs text-primary">
                  <Phone size={12} /> {delivery.customer_phone}
                </a>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Livreur</p>
              <p className="text-sm font-medium text-foreground">
                {riderProfile?.first_name ?? "—"} {riderProfile?.last_name ?? ""}
              </p>
              {riderProfile?.phone && (
                <a href={`tel:${riderProfile.phone}`} className="flex items-center gap-1 text-xs text-primary">
                  <Phone size={12} /> {riderProfile.phone}
                </a>
              )}
            </div>
          </div>

          {/* Order link */}
          {orderId && (
            <Link
              to={`/admin/orders/${orderId}`}
              className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-xs font-medium rounded-lg bg-foreground text-background hover:opacity-90"
            >
              <ExternalLink size={12} /> Voir la commande complète
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}