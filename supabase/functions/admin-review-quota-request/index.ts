/**
 * admin-review-quota-request — Lot 11B Phase B3
 * Approuve ou rejette une demande de quota rider. Si approuvé, met à jour delivery_operators.max_riders.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  granted_quota: z.number().int().min(1).max(30).optional(),
  rejection_reason: z.string().trim().max(500).optional(),
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
    const { request_id, decision, granted_quota, rejection_reason } = parsed.data;

    const { data: reqRow } = await svc
      .from("operator_quota_requests")
      .select("id, operator_id, current_quota, requested_quota, status")
      .eq("id", request_id)
      .maybeSingle();
    if (!reqRow) return json({ error: "Demande introuvable" }, 404);
    if (reqRow.status !== "pending") {
      return json({ error: `Déjà traitée (${reqRow.status})` }, 409);
    }

    const { data: op } = await svc
      .from("delivery_operators")
      .select("id, owner_user_id, company_name, max_riders")
      .eq("id", reqRow.operator_id)
      .maybeSingle();
    if (!op) return json({ error: "Opérateur introuvable" }, 404);

    if (decision === "approve") {
      const finalQuota = granted_quota ?? reqRow.requested_quota;
      if (finalQuota < reqRow.current_quota) {
        return json({ error: "Le quota accordé doit être ≥ quota courant" }, 400);
      }
      const { error: e1 } = await svc
        .from("operator_quota_requests")
        .update({ status: "approved", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq("id", request_id);
      if (e1) return json({ error: "Update request failed", details: e1.message }, 500);

      const { error: e2 } = await svc
        .from("delivery_operators")
        .update({ max_riders: finalQuota })
        .eq("id", op.id);
      if (e2) return json({ error: "Update operator failed", details: e2.message }, 500);

      try {
        await svc.from("admin_audit_logs").insert({
          admin_id: adminId,
          target_user_id: op.owner_user_id,
          action: "approve_quota_request",
          details: { request_id, operator_id: op.id, granted_quota: finalQuota },
        });
        await svc.from("notifications").insert({
          user_id: op.owner_user_id,
          type: "quota_approved",
          title: "Quota livreurs augmenté",
          message: `Votre quota a été porté à ${finalQuota} livreurs pour "${op.company_name}".`,
          link: "/operator/fleet",
        });
      } catch (e) {
        console.warn("[admin-review-quota] post warn", e);
      }

      return json({ success: true, granted_quota: finalQuota });
    } else {
      const { error: e1 } = await svc
        .from("operator_quota_requests")
        .update({
          status: "rejected",
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejection_reason ?? null,
        })
        .eq("id", request_id);
      if (e1) return json({ error: "Update failed", details: e1.message }, 500);

      try {
        await svc.from("admin_audit_logs").insert({
          admin_id: adminId,
          target_user_id: op.owner_user_id,
          action: "reject_quota_request",
          details: { request_id, operator_id: op.id, rejection_reason },
        });
        await svc.from("notifications").insert({
          user_id: op.owner_user_id,
          type: "quota_rejected",
          title: "Demande de quota refusée",
          message: `Votre demande d'augmentation de quota a été refusée.${rejection_reason ? " Motif: " + rejection_reason : ""}`,
          link: "/operator/fleet",
        });
      } catch (e) {
        console.warn("[admin-review-quota] post warn", e);
      }

      return json({ success: true });
    }
  } catch (e) {
    console.error("[admin-review-quota-request] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}