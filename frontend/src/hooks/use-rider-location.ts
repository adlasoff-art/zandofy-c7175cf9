import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that broadcasts the rider's GPS position in real-time.
 * Only active when `enabled` is true (rider has an active delivery).
 */
export function useRiderLocationBroadcast(riderId: string | undefined, deliveryId: string | undefined, enabled: boolean) {
  const watchId = useRef<number | null>(null);

  const updateLocation = useCallback(async (pos: GeolocationPosition) => {
    if (!riderId) return;
    const { latitude, longitude, heading, speed } = pos.coords;
    await supabase.from("rider_locations" as any).upsert(
      {
        rider_id: riderId,
        delivery_id: deliveryId || null,
        latitude,
        longitude,
        heading: heading || null,
        speed: speed || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "rider_id" }
    );
  }, [riderId, deliveryId]);

  useEffect(() => {
    if (!enabled || !riderId || !navigator.geolocation) return;

    // Initial position
    navigator.geolocation.getCurrentPosition(updateLocation, console.error, {
      enableHighAccuracy: true,
    });

    // Watch position
    watchId.current = navigator.geolocation.watchPosition(updateLocation, console.error, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [enabled, riderId, updateLocation]);
}

/**
 * Hook to subscribe to a rider's real-time location updates.
 */
export function useRiderLocationSubscription(
  deliveryId: string | undefined,
  onUpdate: (lat: number, lng: number) => void
) {
  useEffect(() => {
    if (!deliveryId) return;

    // Initial fetch
    supabase
      .from("rider_locations" as any)
      .select("latitude, longitude")
      .eq("delivery_id", deliveryId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) onUpdate(data.latitude, data.longitude);
      });

    // Real-time subscription
    const channel = supabase
      .channel(`rider-loc-${deliveryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rider_locations",
          filter: `delivery_id=eq.${deliveryId}`,
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
  }, [deliveryId, onUpdate]);
}
