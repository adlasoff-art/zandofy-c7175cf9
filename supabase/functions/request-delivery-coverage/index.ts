/**
 * request-delivery-coverage — Lot final consolidation
 *
 * Permet à un client d'enregistrer une demande de couverture pour une zone
 * non desservie par les opérateurs au checkout. Notifie les admins.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  country_code: z.string().min(2).max(3).default("CD"),
  city: z.string().min(1).max(100),
  commune: z.string().max(120).nullable().optional(),
  quartier: z.string().max(120).nullable().optional(),
  commune_id: z.string().uuid().nullable().optional(),
  quartier_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
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
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const input = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    // Anti-spam : 1 demande identique par utilisateur / 24h
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: existing } = await svc
      .from("coverage_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("city", input.city)
      .eq("commune", input.commune ?? null)
      .gte("requested_at", since);
    if ((existing ?? 0) > 0) {
      return json({ success: true, deduplicated: true, message: "Demande déjà enregistrée récemment." });
    }

    const { data: row, error: insErr } = await svc
      .from("coverage_requests")
      .insert({
        user_id: userId,
        country_code: input.country_code,
        city: input.city,
        commune: input.commune ?? null,
        quartier: input.quartier ?? null,
        commune_id: input.commune_id ?? null,
        quartier_id: input.quartier_id ?? null,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();
    if (insErr) return json({ error: "Insert failed", details: insErr.message }, 500);

    // Notif admins
    try {
      const { data: admins } = await svc
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins && admins.length > 0) {
        const zone = [input.quartier, input.commune, input.city].filter(Boolean).join(", ");
        const rows = admins.map((a: any) => ({
          user_id: a.user_id,
          type: "coverage_request_new",
          title: "Nouvelle demande de couverture",
          message: `Un client demande la livraison à ${zone}.`,
          link: "/admin/coverage-requests",
        }));
        await svc.from("notifications").insert(rows);
      }
    } catch (e) {
      console.warn("[request-delivery-coverage] admin notif failed", e);
    }

    return json({ success: true, request_id: row.id });
  } catch (e) {
    console.error("[request-delivery-coverage] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}