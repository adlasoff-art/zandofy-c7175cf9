/**
 * Dynamic Shipping Calculator Engine
 * 
 * Flow: Origin City → Zone → Route → Haversine Distance → Price
 * Supports: weight-based (kg), volume-based (CBM), per-unit, per-km, fixed
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface City {
  id: string;
  name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  population: number;
  zone_id: string | null;
  logistic_zone_id: string | null;
  zone?: { id: string; name: string };
  logistic_zone?: { id: string; name: string; continent: string };
}

export interface LogisticZone {
  id: string;
  name: string;
  continent: string;
}

export interface DynamicQuoteRequest {
  origin_city_id: string;
  destination_city_id: string;
  mode: string;
  weight_grams?: number;
  volume_cbm?: number;
  quantity?: number;
  unit?: string; // kg | cbm | unit | km | fixed
}

export interface DynamicQuoteResult {
  base_price: number;
  fuel_surcharge: number;
  total_price: number;
  currency: string;
  distance_km: number;
  transit_min: number | null;
  transit_max: number | null;
  fuel_percent: number;
  mode: string;
  unit: string;
  origin_city: string;
  destination_city: string;
  origin_zone: string;
  destination_zone: string;
  pack_efficiency?: { units_per_kg: number; weight_grams: number };
  route_type: "specific" | "default";
}

// ── Haversine (client-side fallback) ──

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── City Search (autocomplete) ──

export async function searchCities(query: string, limit = 15): Promise<City[]> {
  if (!query.trim()) {
    const { data } = await supabase
      .from("cities")
      .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
      .order("population", { ascending: false })
      .limit(limit);
    return (data || []) as unknown as City[];
  }

  const { data } = await supabase
    .from("cities")
    .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
    .ilike("name", `%${query}%`)
    .order("population", { ascending: false })
    .limit(limit);
  return (data || []) as unknown as City[];
}

// ── Fetch all logistic zones ──

export async function fetchLogisticZones(): Promise<LogisticZone[]> {
  const { data } = await supabase
    .from("logistic_zones")
    .select("*")
    .order("continent, name");
  return (data || []) as LogisticZone[];
}

// ── Dynamic Quote Calculation ──

export async function calculateDynamicQuote(req: DynamicQuoteRequest): Promise<DynamicQuoteResult | null> {
  // 1. Fetch both cities with zone info
  const { data: cities } = await supabase
    .from("cities")
    .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
    .in("id", [req.origin_city_id, req.destination_city_id]);

  if (!cities || cities.length < 2) return null;

  const origin = cities.find((c: any) => c.id === req.origin_city_id) as any;
  const dest = cities.find((c: any) => c.id === req.destination_city_id) as any;
  if (!origin || !dest) return null;

  // 2. Calculate Haversine distance
  const distance_km = haversineDistance(
    origin.latitude, origin.longitude,
    dest.latitude, dest.longitude
  );

  // 3. Find matching route (zone → zone)
  // Try specific zone IDs first, then logistic zones
  let route: any = null;
  let routeType: "specific" | "default" = "specific";

  if (origin.zone_id && dest.zone_id) {
    const { data } = await supabase
      .from("shipping_routes")
      .select("*, origin_zone:shipping_zones!shipping_routes_origin_zone_id_fkey(name), destination_zone:shipping_zones!shipping_routes_destination_zone_id_fkey(name)")
      .eq("origin_zone_id", origin.zone_id)
      .eq("destination_zone_id", dest.zone_id)
      .eq("transport_mode", req.mode)
      .eq("is_active", true)
      .maybeSingle();
    route = data;
  }

  // 4. Fallback to default rates
  let rate_price = 0;
  let rate_unit = req.unit || "kg";
  let fuel_pct = 0;
  let min_charge = 0;
  let transit_min: number | null = null;
  let transit_max: number | null = null;
  let origin_zone_name = origin.zone?.name || origin.logistic_zone?.name || "—";
  let dest_zone_name = dest.zone?.name || dest.logistic_zone?.name || "—";

  if (route) {
    rate_price = Number(route.rate_price);
    rate_unit = route.rate_unit;
    fuel_pct = Number(route.fuel_surcharge_pct);
    min_charge = Number(route.min_charge);
    transit_min = route.transit_days_min;
    transit_max = route.transit_days_max;
    origin_zone_name = route.origin_zone?.name || origin_zone_name;
    dest_zone_name = route.destination_zone?.name || dest_zone_name;
  } else {
    routeType = "default";
    // Try origin-specific default first, then global fallback
    const { data: defs } = await supabase
      .from("shipping_defaults")
      .select("*")
      .eq("mode", req.mode)
      .order("origin_country", { ascending: true, nullsFirst: false });

    const originCountry = origin.country_code;
    const specificDef = (defs || []).find((d: any) => d.origin_country === originCountry);
    const globalDef = (defs || []).find((d: any) => !d.origin_country);
    const def = specificDef || globalDef;

    if (!def) return null;
    rate_price = Number(def.default_rate);
    rate_unit = def.rate_unit;
  }

  // 5. Calculate quantity based on unit
  let quantity = 1;
  if (rate_unit === "kg") {
    const wg = req.weight_grams || 0;
    quantity = Math.max(wg / 1000, 0.001);
  } else if (rate_unit === "cbm") {
    quantity = Math.max(req.volume_cbm || 0, 0.001);
  } else if (rate_unit === "km") {
    quantity = Math.max(distance_km, 1);
  } else if (rate_unit === "unit") {
    quantity = Math.max(req.quantity || 1, 1);
  }
  // fixed → quantity = 1

  // 6. Compute price
  let base_price = Math.round(rate_price * quantity * 10000) / 10000;
  base_price = Math.max(base_price, min_charge);

  const fuel_surcharge = Math.round(base_price * (fuel_pct / 100) * 100) / 100;
  const total_price = Math.round((base_price + fuel_surcharge) * 100) / 100;

  // 7. Pack efficiency for sub-1kg items (weight-based)
  let pack_efficiency: DynamicQuoteResult["pack_efficiency"];
  if (rate_unit === "kg" && req.weight_grams && req.weight_grams > 0 && req.weight_grams < 1000) {
    pack_efficiency = {
      weight_grams: req.weight_grams,
      units_per_kg: Math.floor(1000 / req.weight_grams),
    };
  }

  return {
    base_price,
    fuel_surcharge,
    total_price,
    currency: "USD",
    distance_km: Math.round(distance_km),
    transit_min,
    transit_max,
    fuel_percent: fuel_pct,
    mode: req.mode,
    unit: rate_unit,
    origin_city: `${origin.name} (${origin.country_code})`,
    destination_city: `${dest.name} (${dest.country_code})`,
    origin_zone: origin_zone_name,
    destination_zone: dest_zone_name,
    pack_efficiency,
    route_type: routeType,
  };
}
