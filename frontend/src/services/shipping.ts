// Dynamic Freight & Shipping Engine
import { supabase } from "@/integrations/supabase/client";

export interface ShippingZone {
  id: string;
  name: string;
  zone_type: string;
  country_code: string | null;
  city: string | null;
  created_at: string;
}

export interface ShippingRoute {
  id: string;
  origin_zone_id: string;
  destination_zone_id: string;
  transport_mode: string;
  rate_unit: string;
  rate_price: number;
  min_charge: number;
  fuel_surcharge_pct: number;
  transit_days_min: number | null;
  transit_days_max: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  origin_zone?: ShippingZone;
  destination_zone?: ShippingZone;
}

export interface CategorySurcharge {
  id: string;
  category_id: string;
  surcharge_type: string;
  surcharge_value: number;
  label: string;
  is_active: boolean;
}

export interface ShippingDefault {
  id: string;
  mode: string;
  default_rate: number;
  rate_unit: string;
  currency: string;
}

export interface ShippingQuote {
  baseRate: number;
  fuelSurcharge: number;
  categorySurcharge: number;
  totalCost: number;
  currency: string;
  mode: string;
  transitDays: string;
  packEfficiency?: { unitsPerKg: number; weightGrams: number };
}

// ── Fetch helpers ──

export async function fetchShippingZones(): Promise<ShippingZone[]> {
  const { data, error } = await supabase
    .from("shipping_zones")
    .select("*")
    .order("name");
  if (error) { console.error("fetchShippingZones:", error); return []; }
  return (data || []) as ShippingZone[];
}

export async function fetchShippingRoutes(): Promise<ShippingRoute[]> {
  const { data, error } = await supabase
    .from("shipping_routes")
    .select("*, origin_zone:shipping_zones!shipping_routes_origin_zone_id_fkey(*), destination_zone:shipping_zones!shipping_routes_destination_zone_id_fkey(*)")
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchShippingRoutes:", error); return []; }
  return (data || []).map((r: any) => ({
    ...r,
    rate_price: Number(r.rate_price),
    min_charge: Number(r.min_charge),
    fuel_surcharge_pct: Number(r.fuel_surcharge_pct),
    origin_zone: r.origin_zone,
    destination_zone: r.destination_zone,
  }));
}

export async function fetchShippingDefaults(): Promise<ShippingDefault[]> {
  const { data, error } = await supabase
    .from("shipping_defaults")
    .select("*")
    .order("mode");
  if (error) { console.error("fetchShippingDefaults:", error); return []; }
  return (data || []).map((d: any) => ({ ...d, default_rate: Number(d.default_rate) }));
}

export async function fetchCategorySurcharges(): Promise<(CategorySurcharge & { category_name?: string })[]> {
  const { data, error } = await supabase
    .from("category_surcharges")
    .select("*, categories(name)")
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchCategorySurcharges:", error); return []; }
  return (data || []).map((s: any) => ({
    ...s,
    surcharge_value: Number(s.surcharge_value),
    category_name: s.categories?.name,
  }));
}

// ── CRUD ──

export async function upsertShippingZone(zone: Partial<ShippingZone> & { name: string; zone_type: string }) {
  if (zone.id) {
    return supabase.from("shipping_zones").update(zone).eq("id", zone.id).select().single();
  }
  return supabase.from("shipping_zones").insert(zone).select().single();
}

export async function deleteShippingZone(id: string) {
  return supabase.from("shipping_zones").delete().eq("id", id);
}

export async function upsertShippingRoute(route: any) {
  const payload = { ...route };
  delete payload.origin_zone;
  delete payload.destination_zone;
  if (payload.id) {
    return supabase.from("shipping_routes").update(payload).eq("id", payload.id).select().single();
  }
  return supabase.from("shipping_routes").insert(payload).select().single();
}

export async function deleteShippingRoute(id: string) {
  return supabase.from("shipping_routes").delete().eq("id", id);
}

export async function upsertShippingDefault(def: Partial<ShippingDefault> & { mode: string }) {
  if (def.id) {
    return supabase.from("shipping_defaults").update(def).eq("id", def.id).select().single();
  }
  return supabase.from("shipping_defaults").insert(def).select().single();
}

export async function upsertCategorySurcharge(s: any) {
  const payload = { ...s };
  delete payload.category_name;
  delete payload.categories;
  if (payload.id) {
    return supabase.from("category_surcharges").update(payload).eq("id", payload.id).select().single();
  }
  return supabase.from("category_surcharges").insert(payload).select().single();
}

export async function deleteCategorySurcharge(id: string) {
  return supabase.from("category_surcharges").delete().eq("id", id);
}

// ── Smart Calculation Engine ──

/**
 * Calculate shipping quote with high-precision math.
 * Supports Air (per kg), Sea (per CBM), Road (fixed/per km).
 */
export function calculateShippingQuote(params: {
  route: ShippingRoute;
  weightGrams?: number;
  volumeCBM?: number;
  distanceKm?: number;
  categorySurchargeValue?: number;
  categorySurchargeType?: string;
}): ShippingQuote {
  const { route, weightGrams = 0, volumeCBM = 0, distanceKm = 0, categorySurchargeValue = 0, categorySurchargeType = "percentage" } = params;

  let quantity = 0;
  if (route.rate_unit === "kg") {
    // Convert grams to kg with high precision
    quantity = Math.max(weightGrams / 1000, 0.001);
  } else if (route.rate_unit === "cbm") {
    quantity = Math.max(volumeCBM, 0.001);
  } else if (route.rate_unit === "km") {
    quantity = Math.max(distanceKm, 1);
  } else {
    // fixed
    quantity = 1;
  }

  // Base rate with high precision (round to 4 decimals during calc)
  let baseRate = Math.round(route.rate_price * quantity * 10000) / 10000;
  baseRate = Math.max(baseRate, route.min_charge);

  // Fuel surcharge
  const fuelSurcharge = Math.round(baseRate * (route.fuel_surcharge_pct / 100) * 100) / 100;

  // Category surcharge
  let catSurcharge = 0;
  if (categorySurchargeType === "percentage") {
    catSurcharge = Math.round(baseRate * (categorySurchargeValue / 100) * 100) / 100;
  } else {
    catSurcharge = categorySurchargeValue;
  }

  const totalCost = Math.round((baseRate + fuelSurcharge + catSurcharge) * 100) / 100;

  const transitDays = route.transit_days_min && route.transit_days_max
    ? `${route.transit_days_min}-${route.transit_days_max} jours`
    : "N/A";

  // Pack efficiency for sub-1kg items (Air mode)
  let packEfficiency: ShippingQuote["packEfficiency"];
  if (route.rate_unit === "kg" && weightGrams > 0 && weightGrams < 1000) {
    packEfficiency = {
      weightGrams,
      unitsPerKg: Math.floor(1000 / weightGrams),
    };
  }

  return {
    baseRate,
    fuelSurcharge,
    categorySurcharge: catSurcharge,
    totalCost,
    currency: "USD",
    mode: route.transport_mode,
    transitDays,
    packEfficiency,
  };
}

/**
 * Find the best route for a given origin/destination/mode, falling back to defaults.
 */
export async function getQuoteForShipment(params: {
  originZoneId: string;
  destinationZoneId: string;
  mode: string;
  weightGrams?: number;
  volumeCBM?: number;
  distanceKm?: number;
  categoryId?: string;
}): Promise<ShippingQuote | null> {
  // 1. Try specific route
  const { data: route } = await supabase
    .from("shipping_routes")
    .select("*")
    .eq("origin_zone_id", params.originZoneId)
    .eq("destination_zone_id", params.destinationZoneId)
    .eq("transport_mode", params.mode)
    .eq("is_active", true)
    .maybeSingle();

  // 2. Fallback to default
  let effectiveRoute: ShippingRoute;
  if (route) {
    effectiveRoute = { ...route, rate_price: Number(route.rate_price), min_charge: Number(route.min_charge), fuel_surcharge_pct: Number(route.fuel_surcharge_pct) };
  } else {
    const { data: def } = await supabase
      .from("shipping_defaults")
      .select("*")
      .eq("mode", params.mode)
      .maybeSingle();
    if (!def) return null;
    effectiveRoute = {
      id: "default",
      origin_zone_id: params.originZoneId,
      destination_zone_id: params.destinationZoneId,
      transport_mode: params.mode,
      rate_unit: def.rate_unit,
      rate_price: Number(def.default_rate),
      min_charge: 0,
      fuel_surcharge_pct: 0,
      transit_days_min: null,
      transit_days_max: null,
      is_active: true,
      notes: "Default rate",
      created_at: "",
      updated_at: "",
    };
  }

  // 3. Get category surcharge
  let surchargeValue = 0;
  let surchargeType = "percentage";
  if (params.categoryId) {
    const { data: cs } = await supabase
      .from("category_surcharges")
      .select("surcharge_value, surcharge_type")
      .eq("category_id", params.categoryId)
      .eq("is_active", true)
      .maybeSingle();
    if (cs) {
      surchargeValue = Number(cs.surcharge_value);
      surchargeType = cs.surcharge_type;
    }
  }

  return calculateShippingQuote({
    route: effectiveRoute,
    weightGrams: params.weightGrams,
    volumeCBM: params.volumeCBM,
    distanceKm: params.distanceKm,
    categorySurchargeValue: surchargeValue,
    categorySurchargeType: surchargeType,
  });
}
