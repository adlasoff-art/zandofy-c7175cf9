/**
 * admin-archive-operator — Lot final consolidation
 *
 * Archive (soft delete) un opérateur de livraison.
 * - Refus si assignations actives (statut ≠ delivered/cancelled/failed).
 * - Désactive automatiquement tous ses tarifs.
 * - Notifie l'owner.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  operator_id: z.string().uuid(),
  reason: z.string().min(3).max(500),
  force: z.boolean().optional().default(false),
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
    const { operator_id, reason, force } = parsed.data;

    const { data: op, error: opErr } = await svc
      .from("delivery_operators")
      .select("id, owner_user_id, company_name, archived_at")
      .eq("id", operator_id)
      .maybeSingle();
    if (opErr || !op) return json({ error: "Opérateur introuvable" }, 404);
    if (op.archived_at) return json({ error: "Déjà archivé" }, 409);

    // Vérifie assignations actives
    const { count: activeCount } = await svc
      .from("delivery_assignments")
      .select("id", { count: "exact", head: true })
      .eq("operator_id", operator_id)
      .not("status", "in", "(delivered,cancelled,failed)");
    if ((activeCount ?? 0) > 0 && !force) {
      return json({
        error: `Impossible d'archiver : ${activeCount} livraison(s) en cours. Forcer en passant force=true (déconseillé).`,
        active_assignments: activeCount,
      }, 409);
    }

    const { error: updErr } = await svc
      .from("delivery_operators")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: adminId,
        archive_reason: reason,
        is_active: false,
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", operator_id);
    if (updErr) return json({ error: "Archive failed", details: updErr.message }, 500);

    // Désactive ses tarifs
    await svc
      .from("delivery_operator_rates")
      .update({ is_active: false, status: "archived", updated_at: new Date().toISOString() })
      .eq("operator_id", operator_id)
      .neq("status", "archived");

    // Activity log
    try {
      await svc.from("activity_logs").insert({
        user_id: adminId,
        action: "operator.archive",
        entity_type: "delivery_operator",
        entity_id: operator_id,
        metadata: { reason, forced: force, active_assignments: activeCount ?? 0 },
      });
    } catch (_) {}

    // Notif owner
    try {
      if (op.owner_user_id) {
        await svc.from("notifications").insert({
          user_id: op.owner_user_id,
          type: "operator_archived",
          title: "Compte opérateur archivé",
          message: `Votre compte opérateur a été archivé par l'administration. Motif : ${reason}`,
          link: "/operator/settings",
        });
      }
    } catch (_) {}

    return json({ success: true });
  } catch (e) {
    console.error("[admin-archive-operator] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}