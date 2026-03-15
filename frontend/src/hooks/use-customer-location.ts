import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that broadcasts the customer's GPS position in real-time.
 * Only active when `enabled` is true (order is out_for_delivery or rider_assigned).
 */
export function useCustomerLocationBroadcast(
  userId: string | undefined,
  orderId: string | undefined,
  enabled: boolean
) {
  const watchId = useRef<number | null>(null);

  const updateLocation = useCallback(
    async (pos: GeolocationPosition) => {
      if (!userId || !orderId) return;
      const { latitude, longitude } = pos.coords;
      await supabase.from("customer_locations" as any).upsert(
        {
          user_id: userId,
          order_id: orderId,
          latitude,
          longitude,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,order_id" }
      );
    },
    [userId, orderId]
  );

  useEffect(() => {
    if (!enabled || !userId || !orderId || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(updateLocation, console.error, {
      enableHighAccuracy: true,
    });

    watchId.current = navigator.geolocation.watchPosition(
      updateLocation,
      console.error,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [enabled, userId, orderId, updateLocation]);
}

/**
 * Hook to subscribe to a customer's real-time location updates (used by rider).
 */
export function useCustomerLocationSubscription(
  orderId: string | undefined,
  onUpdate: (lat: number, lng: number) => void
) {
  useEffect(() => {
    if (!orderId) return;

    // Initial fetch
    supabase
      .from("customer_locations" as any)
      .select("latitude, longitude")
      .eq("order_id", orderId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) onUpdate(data.latitude, data.longitude);
      });

    // Real-time subscription
    const channel = supabase
      .channel(`customer-loc-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_locations",
          filter: `order_id=eq.${orderId}`,
        },
        (payload: any) => {
          const d = payload.new;
          if (d?.latitude && d?.longitude) onUpdate(d.latitude, d.longitude);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, onUpdate]);
}
