/**
 * admin-approve-operator — Lot 11B Phase B3
 *
 * Approuve un opérateur de livraison (KYB validé).
 * - Auth admin/manager requis (validé en code).
 * - Passe `delivery_operators.status` de 'pending' à 'approved'.
 * - Active l'opérateur (is_active = true).
 * - Trace approved_by / approved_at.
 * - Notifie le owner (in-app).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  operator_id: z.string().uuid(),
  commission_pct_override: z.number().min(0).max(50).optional(),
  notes: z.string().trim().max(500).optional(),
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
    const { operator_id, commission_pct_override, notes } = parsed.data;

    const { data: op, error: opErr } = await svc
      .from("delivery_operators")
      .select("id, status, owner_user_id, company_name")
      .eq("id", operator_id)
      .maybeSingle();
    if (opErr || !op) return json({ error: "Opérateur introuvable" }, 404);
    if (op.status !== "pending") {
      return json({ error: `Statut courant: ${op.status}, approbation impossible` }, 409);
    }

    const updatePayload: Record<string, unknown> = {
      status: "approved",
      is_active: true,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    };
    if (typeof commission_pct_override === "number") {
      updatePayload.platform_commission_pct = commission_pct_override;
    }

    const { error: updErr } = await svc
      .from("delivery_operators")
      .update(updatePayload)
      .eq("id", operator_id);
    if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

    // Phase 10.5 — Grant rôle 'operator' au owner pour qu'il accède à /operator/*
    if (op.owner_user_id) {
      const { error: roleErr } = await svc
        .from("user_roles")
        .upsert(
          { user_id: op.owner_user_id, role: "operator" },
          { onConflict: "user_id,role" },
        );
      if (roleErr) console.warn("[admin-approve-operator] role grant failed", roleErr);
    }

    // Audit log (best-effort)
    try {
      await svc.from("admin_audit_logs").insert({
        admin_id: adminId,
        target_user_id: op.owner_user_id,
        action: "approve_operator",
        details: { operator_id, commission_pct_override, notes },
      });
    } catch (e) {
      console.warn("[admin-approve-operator] audit failed", e);
    }

    // Notif owner
    try {
      await svc.from("notifications").insert({
        user_id: op.owner_user_id,
        type: "operator_approved",
        title: "Opérateur approuvé",
        message: `Votre demande d'opérateur "${op.company_name}" a été approuvée.`,
        link: "/operator",
      });
    } catch (e) {
      console.warn("[admin-approve-operator] notif failed", e);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[admin-approve-operator] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}