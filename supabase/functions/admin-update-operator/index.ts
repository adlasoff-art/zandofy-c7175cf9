/**
 * admin-update-operator — Lot final consolidation
 *
 * Permet à un admin de modifier les champs éditables d'un opérateur.
 * Champs sensibles (commission, max_riders, status) tracés en activity log.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  operator_id: z.string().uuid(),
  patch: z.object({
    company_name: z.string().min(1).max(200).optional(),
    legal_name: z.string().max(200).nullable().optional(),
    registration_number: z.string().max(100).nullable().optional(),
    tax_id: z.string().max(100).nullable().optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().max(40).nullable().optional(),
    headquarters_country: z.string().max(80).nullable().optional(),
    headquarters_city: z.string().max(80).nullable().optional(),
    headquarters_address: z.string().max(300).nullable().optional(),
    platform_commission_pct: z.number().min(0).max(100).optional(),
    max_riders: z.number().int().min(0).max(10000).optional(),
    is_active: z.boolean().optional(),
    status: z.enum(["pending", "approved", "suspended", "archived", "rejected"]).optional(),
  }).refine((p) => Object.keys(p).length > 0, { message: "Patch vide" }),
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
    const { operator_id, patch } = parsed.data;

    const { data: before, error: beforeErr } = await svc
      .from("delivery_operators")
      .select("*")
      .eq("id", operator_id)
      .maybeSingle();
    if (beforeErr || !before) return json({ error: "Opérateur introuvable" }, 404);
    if (before.archived_at) return json({ error: "Opérateur archivé — utiliser la restauration" }, 409);

    const { error: updErr } = await svc
      .from("delivery_operators")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", operator_id);
    if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

    // Activity log (best effort)
    try {
      const sensitiveFields = ["platform_commission_pct", "max_riders", "status", "is_active"];
      const sensitiveDiff: Record<string, { from: any; to: any }> = {};
      for (const f of sensitiveFields) {
        if (f in patch && (patch as any)[f] !== (before as any)[f]) {
          sensitiveDiff[f] = { from: (before as any)[f], to: (patch as any)[f] };
        }
      }
      if (Object.keys(sensitiveDiff).length > 0) {
        await svc.from("activity_logs").insert({
          user_id: adminId,
          action: "operator.update_sensitive",
          entity_type: "delivery_operator",
          entity_id: operator_id,
          metadata: sensitiveDiff,
        });
      }
    } catch (_) {}

    // Notif owner si commission ou status changés
    try {
      if ("platform_commission_pct" in patch || "status" in patch) {
        if (before.owner_user_id) {
          await svc.from("notifications").insert({
            user_id: before.owner_user_id,
            type: "operator_updated_by_admin",
            title: "Mise à jour de votre compte opérateur",
            message: "L'administration a mis à jour les paramètres de votre opérateur.",
            link: "/operator/settings",
          });
        }
      }
    } catch (_) {}

    return json({ success: true });
  } catch (e) {
    console.error("[admin-update-operator] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}