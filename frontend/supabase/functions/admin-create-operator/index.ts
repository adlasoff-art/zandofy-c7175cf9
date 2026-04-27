/**
 * admin-create-operator — Phase 10
 *
 * Création manuelle d'un opérateur de livraison par un admin (sans modération KYB).
 * - Auth admin obligatoire (vérifié en code).
 * - Si owner_user_id fourni : associé à l'opérateur. Sinon, opérateur orphelin.
 * - Statut directement 'approved' + is_active=true (l'admin certifie sur place).
 * - Insert villes de couverture + grant rôle 'operator' au owner.
 * - Notifie l'utilisateur ciblé (in-app, best-effort).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VEHICLE_TYPES = ["moto", "voiture", "tricycle", "camionnette", "velo"] as const;

const VehicleAggSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  count: z.number().int().min(1).max(50),
});

const FleetVehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  plate_number: z.string().trim().min(3).max(20),
  brand: z.string().trim().max(40).optional(),
  model: z.string().trim().max(40).optional(),
});

const CitySchema = z.object({
  city: z.string().trim().min(1).max(80),
  country_code: z.string().trim().length(2),
  province_id: z.string().uuid().optional().nullable(),
  commune_ids: z.array(z.string().uuid()).min(1).max(100),
  quartier_ids: z.array(z.string().uuid()).max(500).optional().default([]),
});

const RateSchema = z.object({
  country_code: z.string().trim().length(2),
  city: z.string().trim().min(1).max(80),
  zone_name: z.string().trim().min(1).max(60).default("Standard"),
  base_price: z.number().min(0).max(10000),
  surcharge: z.number().min(0).max(10000).default(0),
  estimated_minutes: z.number().int().min(1).max(1440).default(60),
});

const MIN_FLEET = 3;
const MIN_RIDERS = 3;

const BodySchema = z.object({
  owner_user_id: z.string().uuid().optional().nullable(),
  company_name: z.string().trim().min(2).max(120),
  legal_name: z.string().trim().max(160).optional().nullable(),
  registration_number: z.string().trim().max(60).optional().nullable(),
  tax_id: z.string().trim().max(60).optional().nullable(),
  contact_email: z.string().trim().email().max(160),
  contact_phone: z.string().trim().min(6).max(40),
  headquarters_country: z.string().trim().length(2),
  headquarters_city: z.string().trim().min(1).max(80),
  headquarters_address: z.string().trim().max(255).optional().nullable(),
  fleet_vehicles: z.array(FleetVehicleSchema).min(MIN_FLEET).max(100),
  vehicle_types: z.array(VehicleAggSchema).min(1).max(6).optional(),
  declared_riders_count: z.number().int().min(MIN_RIDERS).max(50),
  max_riders: z.number().int().min(MIN_RIDERS).max(100).optional(),
  cities: z.array(CitySchema).min(1).max(50),
  initial_rates: z.array(RateSchema).max(50).optional().default([]),
  is_platform_owned: z.boolean().optional().default(false),
  platform_commission_pct: z.number().min(0).max(100).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const svc = createClient(supabaseUrl, serviceKey);

    // Vérification rôle admin
    const { data: roles } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    // Vérification: plaques uniques dans la flotte
    const plates = body.fleet_vehicles.map((v) => v.plate_number.trim().toUpperCase());
    const dup = plates.find((p, i) => plates.indexOf(p) !== i);
    if (dup) {
      return json({ error: `Plaque dupliquée dans la flotte: ${dup}` }, 400);
    }

    // Dérive vehicle_types agrégé si absent
    const vehicleTypesAgg = body.vehicle_types && body.vehicle_types.length > 0
      ? body.vehicle_types
      : Object.entries(
          body.fleet_vehicles.reduce<Record<string, number>>((acc, v) => {
            acc[v.type] = (acc[v.type] || 0) + 1;
            return acc;
          }, {})
        ).map(([type, count]) => ({ type, count }));

    // Anti-doublon si owner_user_id fourni
    if (body.owner_user_id) {
      const { data: existing } = await svc
        .from("delivery_operators")
        .select("id, status")
        .eq("owner_user_id", body.owner_user_id)
        .in("status", ["pending", "approved", "suspended"])
        .maybeSingle();
      if (existing) {
        return json({ error: "Cet utilisateur a déjà un dossier opérateur.", existing }, 409);
      }
    }

    const insertPayload: Record<string, unknown> = {
      owner_user_id: body.owner_user_id ?? callerId,
      company_name: body.company_name,
      legal_name: body.legal_name ?? null,
      registration_number: body.registration_number ?? null,
      tax_id: body.tax_id ?? null,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone,
      headquarters_country: body.headquarters_country,
      headquarters_city: body.headquarters_city,
      headquarters_address: body.headquarters_address ?? null,
      vehicle_types: vehicleTypesAgg,
      fleet_vehicles: body.fleet_vehicles.map((v) => ({
        type: v.type,
        plate_number: v.plate_number.trim().toUpperCase(),
        ...(v.brand ? { brand: v.brand } : {}),
        ...(v.model ? { model: v.model } : {}),
      })),
      declared_riders_count: body.declared_riders_count,
      max_riders: body.max_riders ?? body.declared_riders_count,
      status: "approved",
      is_active: true,
      is_platform_owned: body.is_platform_owned ?? false,
      approved_at: new Date().toISOString(),
      approved_by: callerId,
    };
    if (typeof body.platform_commission_pct === "number") {
      insertPayload.platform_commission_pct = body.platform_commission_pct;
    }

    const { data: op, error: opErr } = await svc
      .from("delivery_operators")
      .insert(insertPayload)
      .select("id")
      .single();
    if (opErr || !op) {
      return json({ error: "Création opérateur échouée", details: opErr?.message }, 500);
    }

    // Villes de couverture
    if (body.cities.length) {
      await svc.from("delivery_operator_cities").insert(
        body.cities.map((c) => ({
          operator_id: op.id,
          city: c.city,
          country_code: c.country_code,
          province_id: c.province_id ?? null,
          commune_ids: c.commune_ids,
          quartier_ids: c.quartier_ids ?? [],
          is_active: true,
        })),
      );
    }

    // Tarifs initiaux : INSERT puis UPDATE -> approved (création admin = approuvé d'office).
    // Le trigger force_pending_on_rate_change force 'pending' à l'INSERT (sauf platform-owned),
    // donc on ré-approuve explicitement avec reviewed_by pour rendre l'opérateur visible côté client.
    if (body.initial_rates && body.initial_rates.length > 0) {
      const ratesPayload = body.initial_rates.map((r) => ({
        operator_id: op.id,
        country_code: r.country_code.toUpperCase(),
        city: r.city.trim(),
        zone_name: r.zone_name || "Standard",
        base_price: r.base_price,
        surcharge: r.surcharge ?? 0,
        estimated_minutes: r.estimated_minutes ?? 60,
        currency: "USD",
        is_active: true,
      }));
      const { data: insertedRates, error: ratesErr } = await svc
        .from("delivery_operator_rates")
        .insert(ratesPayload)
        .select("id");
      if (ratesErr) {
        console.error("[admin-create-operator] rates insert error", ratesErr);
        return json({
          error: `Opérateur créé mais l'enregistrement des tarifs a échoué : ${ratesErr.message}`,
          operator_id: op.id,
        }, 500);
      }
      // Ré-approuver explicitement (skip si platform-owned, déjà approved par trigger)
      if (!body.is_platform_owned && insertedRates && insertedRates.length > 0) {
        const ids = insertedRates.map((r: any) => r.id);
        await svc
          .from("delivery_operator_rates")
          .update({
            status: "approved",
            reviewed_by: callerId,
            reviewed_at: new Date().toISOString(),
          })
          .in("id", ids);
      }
    }

    // Grant rôle operator (si owner réel)
    if (body.owner_user_id) {
      await svc
        .from("user_roles")
        .upsert(
          { user_id: body.owner_user_id, role: "operator" },
          { onConflict: "user_id,role" },
        );

      // Notif in-app
      await svc.from("notifications").insert({
        user_id: body.owner_user_id,
        type: "info",
        title: "Vous êtes opérateur de livraison Zandofy",
        message: `Un administrateur vient d'enregistrer "${body.company_name}". Accédez à votre espace opérateur.`,
        link: "/operator",
      });
    }

    return json({ success: true, operator_id: op.id }, 200);
  } catch (e: unknown) {
    console.error("[admin-create-operator] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}