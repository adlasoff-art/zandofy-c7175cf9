import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = [
    "https://studio.zandofy.com",
    "https://zandofy.com",
    "https://www.zandofy.com",
  ];
  const isAllowed =
    allowed.includes(origin) ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com") ||
    origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { origin_city_id, destination_city_id, mode, weight_grams, volume_cbm, quantity } = body;

    if (!origin_city_id || !destination_city_id || !mode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: origin_city_id, destination_city_id, mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch cities
    const { data: cities, error: citiesError } = await supabase
      .from("cities")
      .select("*, zone:shipping_zones(id, name), logistic_zone:logistic_zones(id, name, continent)")
      .in("id", [origin_city_id, destination_city_id]);

    if (citiesError || !cities || cities.length < 2) {
      return new Response(
        JSON.stringify({ error: "Cities not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = cities.find((c: any) => c.id === origin_city_id);
    const dest = cities.find((c: any) => c.id === destination_city_id);
    if (!origin || !dest) {
      return new Response(
        JSON.stringify({ error: "Origin or destination city not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const distance_km = haversineDistance(origin.latitude, origin.longitude, dest.latitude, dest.longitude);

    // Find route
    let route: any = null;
    let routeType: "specific" | "default" = "specific";

    if (origin.zone_id && dest.zone_id) {
      const { data } = await supabase
        .from("shipping_routes")
        .select("*, origin_zone:shipping_zones!shipping_routes_origin_zone_id_fkey(name), destination_zone:shipping_zones!shipping_routes_destination_zone_id_fkey(name)")
        .eq("origin_zone_id", origin.zone_id)
        .eq("destination_zone_id", dest.zone_id)
        .eq("transport_mode", mode)
        .eq("is_active", true)
        .maybeSingle();
      route = data;
    }

    let rate_price = 0;
    let rate_unit = "kg";
    let fuel_pct = 0;
    let min_charge = 0;
    let transit_min: number | null = null;
    let transit_max: number | null = null;

    if (route) {
      rate_price = Number(route.rate_price);
      rate_unit = route.rate_unit;
      fuel_pct = Number(route.fuel_surcharge_pct);
      min_charge = Number(route.min_charge);
      transit_min = route.transit_days_min;
      transit_max = route.transit_days_max;
    } else {
      routeType = "default";
      // Try origin-specific default first, then global fallback
      const { data: defs } = await supabase
        .from("shipping_defaults")
        .select("*")
        .eq("mode", mode)
        .order("origin_country", { ascending: true, nullsFirst: false });

      const originCountry = origin.country_code;
      const specificDef = (defs || []).find((d: any) => d.origin_country === originCountry);
      const globalDef = (defs || []).find((d: any) => !d.origin_country);
      const def = specificDef || globalDef;

      if (!def) {
        return new Response(
          JSON.stringify({ error: "No rate found for this route/mode" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      rate_price = Number(def.default_rate);
      rate_unit = def.rate_unit;
    }

    let qty = 1;
    if (rate_unit === "kg") qty = Math.max((weight_grams || 0) / 1000, 0.001);
    else if (rate_unit === "cbm") qty = Math.max(volume_cbm || 0, 0.001);
    else if (rate_unit === "km") qty = Math.max(distance_km, 1);
    else if (rate_unit === "unit") qty = Math.max(quantity || 1, 1);

    let base_price = Math.round(rate_price * qty * 10000) / 10000;
    base_price = Math.max(base_price, min_charge);
    const fuel_surcharge = Math.round(base_price * (fuel_pct / 100) * 100) / 100;
    const total_price = Math.round((base_price + fuel_surcharge) * 100) / 100;

    const result = {
      base_price,
      fuel_surcharge,
      total_price,
      currency: "USD",
      distance_km: Math.round(distance_km),
      transit_min,
      transit_max,
      fuel_percent: fuel_pct,
      mode,
      unit: rate_unit,
      origin_city: `${origin.name} (${origin.country_code})`,
      destination_city: `${dest.name} (${dest.country_code})`,
      origin_zone: (origin as any).zone?.name || (origin as any).logistic_zone?.name || "—",
      destination_zone: (dest as any).zone?.name || (dest as any).logistic_zone?.name || "—",
      route_type: routeType,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
