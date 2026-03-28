import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LocalShippingRate {
  id: string;
  zone_name: string;
  city: string;
  country: string;
  base_price: number;
  price_per_km: number;
  vendor_override_allowed: boolean;
  store_id: string | null;
}

/**
 * Hook encapsulating local delivery logic:
 * - Shipping rate lookup by zone
 * - Driver assignment
 * - Local status advancement
 */
export function useLocalDelivery() {
  /** Fetch local shipping rates for a given city */
  const fetchLocalRates = useCallback(async (city: string = "Kinshasa", storeId?: string): Promise<LocalShippingRate[]> => {
    const { data, error } = await (supabase as any)
      .from("local_shipping_rates")
      .select("id, zone_name, city, country, base_price, price_per_km, vendor_override_allowed, store_id")
      .ilike("city", city)
      .order("zone_name");

    if (error) {
      console.error("[useLocalDelivery] fetchLocalRates error:", error);
      return [];
    }
    return (data || []) as LocalShippingRate[];
  }, []);

  /** Calculate shipping cost for a zone */
  const calculateLocalShipping = useCallback((rates: LocalShippingRate[], zoneName: string): number => {
    const rate = rates.find((r) => r.zone_name.toLowerCase() === zoneName.toLowerCase());
    if (!rate) return 0;
    return rate.base_price;
  }, []);

  /** Assign a local driver to an order */
  const assignLocalDriver = useCallback(async (
    orderId: string,
    driverId: string,
    driverName: string,
    deliveryFee?: number,
    paymentMethod?: string,
  ): Promise<boolean> => {
    const confirmationCode = generateCode();
    const updates: Record<string, any> = {
      assigned_driver_id: driverId,
      assigned_driver_name: driverName,
      delivery_option: "home_delivery",
      confirmation_code: confirmationCode,
    };
    if (deliveryFee !== undefined && deliveryFee > 0) {
      updates.last_mile_fee = deliveryFee;
    }
    if (paymentMethod) {
      updates.last_mile_payment_method = paymentMethod;
    }

    const { error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId);

    if (error) {
      console.error("[useLocalDelivery] assignLocalDriver error:", error);
      toast.error("Erreur lors de l'assignation du livreur");
      return false;
    }
    toast.success(`Livreur ${driverName} assigné avec succès`);
    return true;
  }, []);

  return {
    fetchLocalRates,
    calculateLocalShipping,
    assignLocalDriver,
  };
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
