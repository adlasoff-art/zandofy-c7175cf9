/**
 * request-forwarder-coverage — Lot 11C Phase 2
 *
 * Permet à un client de demander la couverture d'une route transitaire
 * (origine→destination + mode) non desservie au checkout. Notifie les admins.
 * Anti-spam : 1 demande identique (user × route × mode) par 24h.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  origin_country: z.string().min(2).max(3),
  destination_country: z.string().min(2).max(3),
  destination_city: z.string().max(120).nullable().optional(),
  destination_city_id: z.string().uuid().nullable().optional(),
  mode: z.enum(["air", "sea", "road", "rail", "express"]),
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
    const originISO = input.origin_country.toUpperCase();
    const destISO = input.destination_country.toUpperCase();

    const svc = createClient(supabaseUrl, serviceKey);

    // Anti-spam : 1 demande identique par utilisateur / 24h sur la même route + mode.
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: existing } = await svc
      .from("forwarder_coverage_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("origin_country", originISO)
      .eq("destination_country", destISO)
      .eq("mode", input.mode)
      .gte("requested_at", since);
    if ((existing ?? 0) > 0) {
      return json({
        success: true,
        deduplicated: true,
        message: "Demande déjà enregistrée récemment.",
      });
    }

    const { data: row, error: insErr } = await svc
      .from("forwarder_coverage_requests")
      .insert({
        user_id: userId,
        origin_country: originISO,
        destination_country: destISO,
        destination_city: input.destination_city ?? null,
        destination_city_id: input.destination_city_id ?? null,
        mode: input.mode,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();
    if (insErr) return json({ error: "Insert failed", details: insErr.message }, 500);

    // Notifier les admins (in-app).
    try {
      const { data: admins } = await svc
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins && admins.length > 0) {
        const message = `Route demandée : ${originISO} → ${destISO} (${input.mode}).`;
        const rows = admins.map((a: any) => ({
          user_id: a.user_id,
          type: "forwarder_coverage_request_new",
          title: "Demande de couverture transitaire",
          message,
          link: "/admin/coverage-requests",
        }));
        await svc.from("notifications").insert(rows);
      }
    } catch (e) {
      console.warn("[request-forwarder-coverage] admin notif failed", e);
    }

    return json({ success: true, request_id: row.id });
  } catch (e) {
    console.error("[request-forwarder-coverage] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}