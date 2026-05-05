/**
 * admin-update-operator-rate
 *
 * Permet à un admin de modifier un tarif opérateur existant en sécurité.
 * Conserve status='approved' et is_active=true (sauf changement explicite),
 * applique les caps si présents, retourne le tarif complet relu.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  rate_id: z.string().uuid(),
  country_code: z.string().min(2).max(3),
  city: z.string().min(1).max(100),
  zone_name: z.string().min(1).max(120),
  commune: z.string().max(120).nullable().optional(),
  quartier: z.string().max(120).nullable().optional(),
  base_price: z.number().min(0),
  surcharge: z.number().min(0).default(0),
  price_per_km: z.number().min(0).default(0),
  currency: z.string().min(3).max(3),
  estimated_minutes: z.number().int().min(1).max(720),
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
    const adminId = userData.user.id;

    const svc = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", adminId);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const input = parsed.data;

    // Charger le tarif et l'opérateur
    const { data: existing, error: exErr } = await svc
      .from("delivery_operator_rates")
      .select("id, operator_id")
      .eq("id", input.rate_id)
      .maybeSingle();
    if (exErr || !existing) return json({ error: "Tarif introuvable" }, 404);

    const { data: op, error: opErr } = await svc
      .from("delivery_operators")
      .select("id, archived_at")
      .eq("id", existing.operator_id)
      .maybeSingle();
    if (opErr || !op) return json({ error: "Opérateur introuvable" }, 404);
    if (op.archived_at) return json({ error: "Opérateur archivé — édition impossible" }, 409);

    // Vérifier les caps si configurés
    try {
      const { data: cap } = await svc
        .from("delivery_operator_city_caps")
        .select("max_base_price, max_surcharge, currency")
        .eq("country_code", input.country_code)
        .eq("city", input.city)
        .maybeSingle();
      if (cap) {
        if (cap.max_base_price != null && Number(input.base_price) > Number(cap.max_base_price)) {
          return json({
            error: `Tarif de base ${input.base_price} ${input.currency} dépasse le plafond ${cap.max_base_price} ${cap.currency || input.currency} pour ${input.city}`,
          }, 400);
        }
        if (cap.max_surcharge != null && Number(input.surcharge) > Number(cap.max_surcharge)) {
          return json({
            error: `Surcharge ${input.surcharge} dépasse le plafond ${cap.max_surcharge} pour ${input.city}`,
          }, 400);
        }
      }
    } catch (_) { /* table absente = non bloquant */ }

    const { error: updErr } = await svc
      .from("delivery_operator_rates")
      .update({
        country_code: input.country_code,
        city: input.city,
        zone_name: input.zone_name,
        commune: input.commune ?? null,
        quartier: input.quartier ?? null,
        base_price: input.base_price,
        surcharge: input.surcharge,
        price_per_km: input.price_per_km,
        currency: input.currency,
        estimated_minutes: input.estimated_minutes,
        // Édition admin = reste approuvé (le trigger respecte status explicite)
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        rejection_reason: null,
      })
      .eq("id", input.rate_id);
    if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

    const { data: confirmed, error: confErr } = await svc
      .from("delivery_operator_rates")
      .select("*")
      .eq("id", input.rate_id)
      .maybeSingle();
    if (confErr || !confirmed) {
      return json({ error: "Update non confirmé", details: confErr?.message ?? null }, 500);
    }

    return json({ success: true, rate: confirmed });
  } catch (e) {
    console.error("[admin-update-operator-rate] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}