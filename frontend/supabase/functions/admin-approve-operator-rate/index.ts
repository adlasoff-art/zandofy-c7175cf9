/**
 * admin-approve-operator-rate — Lot 11B Phase B8
 *
 * Approuve un tarif opérateur (delivery_operator_rates) en attente de validation.
 * - Auth admin/manager requis (validé en code).
 * - status: pending -> approved.
 * - Trace reviewed_by / reviewed_at, clear rejection_reason.
 * - Notifie le owner de l'opérateur.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  rate_id: z.string().uuid(),
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
    const isStaff = roles?.some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const { rate_id } = parsed.data;

    const { data: rate, error: rateErr } = await svc
      .from("delivery_operator_rates")
      .select("id, status, operator_id, zone_name, city, base_price, surcharge")
      .eq("id", rate_id)
      .maybeSingle();
    if (rateErr || !rate) return json({ error: "Tarif introuvable" }, 404);
    if (rate.status !== "pending") {
      return json({ error: `Statut courant: ${rate.status}, approbation impossible` }, 409);
    }

    const { error: updErr } = await svc
      .from("delivery_operator_rates")
      .update({
        status: "approved",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", rate_id);
    if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

    // Notif owner opérateur
    try {
      const { data: op } = await svc
        .from("delivery_operators")
        .select("owner_user_id, company_name")
        .eq("id", rate.operator_id)
        .maybeSingle();
      if (op?.owner_user_id) {
        await svc.from("notifications").insert({
          user_id: op.owner_user_id,
          type: "operator_rate_approved",
          title: "Tarif approuvé",
          message: `Votre tarif pour ${rate.zone_name} (${rate.city}) a été approuvé et est désormais visible au checkout.`,
          link: "/operator/rates",
        });
      }
    } catch (e) {
      console.warn("[admin-approve-operator-rate] notif failed", e);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[admin-approve-operator-rate] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}