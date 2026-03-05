import { supabase } from "@/integrations/supabase/client";

export interface DeliveryZoneMatch {
  zoneId: string;
  zoneName: string;
  city: string;
  price: number;
  currency: string;
  estimatedHours: number | null;
  storeId: string;
  storeName: string;
  isSelfDelivery: boolean;
}

/**
 * Given an order's shipping city and store, determine the delivery path:
 * 1. Check if the vendor has self-delivery zones matching the city
 * 2. Fall back to platform logistics (standard rider assignment)
 */
export async function resolveDeliveryPath(orderId: string): Promise<{
  selfDeliveryZones: DeliveryZoneMatch[];
  usePlatformLogistics: boolean;
  order: { shipping_city: string | null; store_id: string | null } | null;
}> {
  // Get order details
  const { data: order } = await supabase
    .from("orders")
    .select("shipping_city, store_id")
    .eq("id", orderId)
    .single();

  if (!order || !order.store_id || !order.shipping_city) {
    return { selfDeliveryZones: [], usePlatformLogistics: true, order };
  }

  // Check if vendor has self-delivery enabled
  const { data: sub } = await supabase
    .from("vendor_subscriptions")
    .select("can_self_deliver, store_id")
    .eq("store_id", order.store_id)
    .maybeSingle();

  if (!sub?.can_self_deliver) {
    return { selfDeliveryZones: [], usePlatformLogistics: true, order };
  }

  // Get vendor's delivery zones matching the shipping city
  const { data: zones } = await supabase
    .from("vendor_delivery_zones")
    .select("id, zone_name, city, price, currency, estimated_hours, store_id")
    .eq("store_id", order.store_id)
    .eq("is_active", true)
    .ilike("city", `%${order.shipping_city}%`);

  // Get store name
  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", order.store_id)
    .single();

  const selfDeliveryZones: DeliveryZoneMatch[] = (zones || []).map((z) => ({
    zoneId: z.id,
    zoneName: z.zone_name,
    city: z.city,
    price: z.price,
    currency: z.currency,
    estimatedHours: z.estimated_hours,
    storeId: z.store_id,
    storeName: store?.name || "",
    isSelfDelivery: true,
  }));

  return {
    selfDeliveryZones,
    usePlatformLogistics: selfDeliveryZones.length === 0,
    order,
  };
}

/**
 * Check if a rider can be assigned to this delivery (availability check).
 * For now: checks if any rider-role users exist. In production this would
 * check rider availability, location, current load etc.
 */
export async function checkRiderAvailability(city: string): Promise<{
  available: boolean;
  riderCount: number;
}> {
  // Get all users with rider role
  const { data: riders } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "rider");

  return {
    available: (riders?.length || 0) > 0,
    riderCount: riders?.length || 0,
  };
}
