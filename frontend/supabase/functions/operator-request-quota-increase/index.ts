/**
 * operator-request-quota-increase — Lot 11B Phase B2
 *
 * Permet à l'owner d'un opérateur de demander une augmentation de son quota max_riders.
 * - Auth : owner uniquement.
 * - Crée une ligne `operator_quota_requests` (status = 'pending').
 * - Notifie les admins.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  requested_quota: z.number().int().min(1).max(30),
  justification: z.string().trim().max(500).optional().nullable(),
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
    const { requested_quota, justification } = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    const { data: op } = await svc
      .from("delivery_operators")
      .select("id, company_name, max_riders, status")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!op) return json({ error: "Aucun opérateur trouvé" }, 403);
    if (op.status !== "approved") return json({ error: "Opérateur non approuvé" }, 403);
    if (requested_quota <= op.max_riders) {
      return json({ error: `Le quota demandé doit être > ${op.max_riders}` }, 400);
    }

    // Bloquer si une demande pending existe déjà
    const { data: existing } = await svc
      .from("operator_quota_requests")
      .select("id")
      .eq("operator_id", op.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return json({ error: "Une demande est déjà en cours de traitement." }, 409);
    }

    const { data: created, error: insErr } = await svc
      .from("operator_quota_requests")
      .insert({
        operator_id: op.id,
        current_quota: op.max_riders,
        requested_quota,
        justification: justification ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !created) {
      return json({ error: insErr?.message ?? "Insertion échouée" }, 500);
    }

    // Notif admins
    try {
      const { data: admins } = await svc.from("user_roles").select("user_id").eq("role", "admin");
      if (admins?.length) {
        const notifs = admins.map((a: any) => ({
          user_id: a.user_id,
          type: "operator_quota_request",
          title: "Demande d'augmentation de quota",
          message: `${op.company_name} demande de passer de ${op.max_riders} à ${requested_quota} livreurs.`,
          link: "/admin/operators",
        }));
        await svc.from("notifications").insert(notifs);
      }
    } catch (e) {
      console.warn("[operator-request-quota-increase] notif failed", e);
    }

    return json({ success: true, request_id: created.id }, 200);
  } catch (e: unknown) {
    console.error("[operator-request-quota-increase] error", e);
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