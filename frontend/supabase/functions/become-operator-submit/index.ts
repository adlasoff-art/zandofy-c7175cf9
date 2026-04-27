/**
 * become-operator-submit — Lot 11B Phase B2
 *
 * Crée une demande d'opérateur de livraison (entreprise).
 * - Auth : utilisateur connecté requis (JWT validé en code).
 * - Vérifie qu'aucun opérateur actif/pending n'existe déjà pour ce user.
 * - Crée la ligne dans `delivery_operators` (status = 'pending').
 * - Insère les villes dans `delivery_operator_cities`.
 * - Donne le rôle `operator` au user.
 * - Notifie les admins (in-app notification, best-effort).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VEHICLE_TYPES = ["moto", "voiture", "tricycle", "camionnette", "velo"] as const;

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

const MIN_FLEET = 3;
const MIN_RIDERS = 3;

const BodySchema = z.object({
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
  declared_riders_count: z.number().int().min(MIN_RIDERS).max(30),
  cities: z.array(CitySchema).min(1).max(50),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

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
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    // Plaques uniques
    const plates = body.fleet_vehicles.map((v) => v.plate_number.trim().toUpperCase());
    const dup = plates.find((p, i) => plates.indexOf(p) !== i);
    if (dup) return json({ error: `Plaque dupliquée: ${dup}` }, 400);

    // vehicle_types agrégé pour rétro-compat
    const vehicleTypesAgg = Object.entries(
      body.fleet_vehicles.reduce<Record<string, number>>((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      }, {})
    ).map(([type, count]) => ({ type, count }));

    const svc = createClient(supabaseUrl, serviceKey);

    // Anti-doublon
    const { data: existing } = await svc
      .from("delivery_operators")
      .select("id, status")
      .eq("owner_user_id", userId)
      .in("status", ["pending", "approved", "suspended"])
      .maybeSingle();
    if (existing) {
      return json(
        { error: "Vous avez déjà une demande en cours ou un opérateur actif.", existing_status: existing.status },
        409,
      );
    }

    // Insert opérateur
    const { data: op, error: opErr } = await svc
      .from("delivery_operators")
      .insert({
        owner_user_id: userId,
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
        max_riders: body.declared_riders_count, // initial cap = déclaré
        status: "pending",
        is_active: false,
      })
      .select("id")
      .single();
    if (opErr || !op) {
      console.error("[become-operator-submit] insert op failed", opErr);
      return json({ error: "Création opérateur échouée", details: opErr?.message }, 500);
    }

    // Villes de couverture
    const citiesPayload = body.cities.map((c) => ({
      operator_id: op.id,
      city: c.city,
      country_code: c.country_code,
      province_id: c.province_id ?? null,
      commune_ids: c.commune_ids,
      quartier_ids: c.quartier_ids ?? [],
      is_active: true,
    }));
    const { error: citiesErr } = await svc.from("delivery_operator_cities").insert(citiesPayload);
    if (citiesErr) {
      console.warn("[become-operator-submit] cities insert warning", citiesErr.message);
    }

    // Rôle operator
    const { error: roleErr } = await svc
      .from("user_roles")
      .upsert({ user_id: userId, role: "operator" }, { onConflict: "user_id,role" });
    if (roleErr) console.warn("[become-operator-submit] role grant warning", roleErr.message);

    // Notif admins (best-effort)
    try {
      const { data: admins } = await svc
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins?.length) {
        const notifs = admins.map((a: any) => ({
          user_id: a.user_id,
          type: "operator_application",
          title: "Nouvelle demande d'opérateur",
          message: `${body.company_name} a soumis une demande pour devenir opérateur.`,
          link: "/admin/operators",
        }));
        await svc.from("notifications").insert(notifs);
      }
    } catch (e) {
      console.warn("[become-operator-submit] notif admins failed", e);
    }

    return json({ success: true, operator_id: op.id, status: "pending" }, 200);
  } catch (e: unknown) {
    console.error("[become-operator-submit] error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}