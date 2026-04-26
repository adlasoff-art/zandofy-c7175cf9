/**
 * admin-reject-operator — Lot 11B Phase B3
 * Rejette une demande opérateur (status pending → rejected) avec motif obligatoire.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  operator_id: z.string().uuid(),
  rejection_reason: z.string().trim().min(5).max(500),
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
    const { operator_id, rejection_reason } = parsed.data;

    const { data: op } = await svc
      .from("delivery_operators")
      .select("id, status, owner_user_id, company_name")
      .eq("id", operator_id)
      .maybeSingle();
    if (!op) return json({ error: "Opérateur introuvable" }, 404);
    if (op.status !== "pending") {
      return json({ error: `Statut courant: ${op.status}, rejet impossible` }, 409);
    }

    const { error: updErr } = await svc
      .from("delivery_operators")
      .update({
        status: "rejected",
        is_active: false,
        rejection_reason,
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", operator_id);
    if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

    try {
      await svc.from("admin_audit_logs").insert({
        admin_id: adminId,
        target_user_id: op.owner_user_id,
        action: "reject_operator",
        details: { operator_id, rejection_reason },
      });
      await svc.from("notifications").insert({
        user_id: op.owner_user_id,
        type: "operator_rejected",
        title: "Demande opérateur refusée",
        message: `Votre demande "${op.company_name}" a été refusée. Motif: ${rejection_reason}`,
        link: "/become-operator",
      });
    } catch (e) {
      console.warn("[admin-reject-operator] post-actions warn", e);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[admin-reject-operator] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}