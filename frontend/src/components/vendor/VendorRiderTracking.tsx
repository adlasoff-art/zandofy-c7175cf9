import { useState, useCallback } from "react";
import { Bike, MapPin, Loader2, Package, Phone } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryMap } from "@/components/DeliveryMap";
import { useRiderLocationSubscription } from "@/hooks/use-rider-location";
import { STATUS_CONFIG } from "@/lib/order-status";
import { toast } from "sonner";

function RiderTrackingCard({ order }: { order: any }) {
  const [riderLat, setRiderLat] = useState<number | null>(null);
  const [riderLng, setRiderLng] = useState<number | null>(null);

  // Find delivery for this order
  const { data: delivery } = useQuery({
    queryKey: ["vendor-delivery", order.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id")
        .eq("order_id", order.id)
        .neq("status", "delivered")
        .maybeSingle();
      return data;
    },
  });

  useRiderLocationSubscription(
    delivery?.id,
    useCallback((lat: number, lng: number) => {
      setRiderLat(lat);
      setRiderLng(lng);
    }, [])
  );

  const cfg = STATUS_CONFIG[order.status];
  const fullAddress = [order.shipping_address, order.shipping_city].filter(Boolean).join(", ");

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground font-mono">{order.order_ref}</p>
          <p className="text-xs text-muted-foreground">
            {order.shipping_first_name} {order.shipping_last_name}
          </p>
        </div>
        {cfg && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}`}>
            {cfg.label}
          </span>
        )}
      </div>

      {order.assigned_rider_name && (
        <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-lg px-3 py-2">
          <Bike size={14} className="text-primary" />
          <span className="text-foreground font-medium">{order.assigned_rider_name}</span>
          {riderLat && (
            <span className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground">GPS actif</span>
            </span>
          )}
        </div>
      )}

      {fullAddress && (
        <div className="flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin size={12} className="shrink-0 mt-0.5" />
          <span>{fullAddress}</span>
        </div>
      )}

      {riderLat && riderLng && (
        <DeliveryMap riderLat={riderLat} riderLng={riderLng} showEta className="h-[200px]" />
      )}

      {!riderLat && delivery && (
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <Bike size={20} className="text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">En attente de la position du livreur...</p>
        </div>
      )}
    </div>
  );
}

interface VendorRiderTrackingProps {
  storeId: string;
}

export function VendorRiderTracking({ storeId }: VendorRiderTrackingProps) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["vendor-rider-orders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_ref, status, shipping_address, shipping_city, shipping_first_name, shipping_last_name, shipping_phone, assigned_rider_id, assigned_rider_name, total")
        .eq("store_id", storeId)
        .not("assigned_rider_id", "is", null)
        .in("status", ["rider_assigned", "out_for_delivery", "in_delivery", "shipped"])
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package size={48} className="text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">Aucune livraison en cours</p>
        <p className="text-xs text-muted-foreground mt-1">
          Les commandes avec un livreur assigné apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bike size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          Suivi des livreurs ({orders.length})
        </h2>
      </div>
      {orders.map((order) => (
        <RiderTrackingCard key={order.id} order={order} />
      ))}
    </div>
  );
}
