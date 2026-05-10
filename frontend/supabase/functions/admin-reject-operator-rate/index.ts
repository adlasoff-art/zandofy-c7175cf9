/**
 * admin-reject-operator-rate — Lot 11B Phase B8
 *
 * Refuse un tarif opérateur en attente.
 * - Auth admin/manager.
 * - status: pending -> rejected, stocke rejection_reason.
 * - Notifie le owner.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  rate_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
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
    const { rate_id, reason } = parsed.data;

    const { data: rate, error: rateErr } = await svc
      .from("delivery_operator_rates")
      .select("id, status, operator_id, zone_name, city")
      .eq("id", rate_id)
      .maybeSingle();
    if (rateErr || !rate) return json({ error: "Tarif introuvable" }, 404);
    if (rate.status !== "pending") {
      return json({ error: `Statut courant: ${rate.status}, refus impossible` }, 409);
    }

    const { error: updErr } = await svc
      .from("delivery_operator_rates")
      .update({
        status: "rejected",
        is_active: false,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("id", rate_id);
    if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

    try {
      const { data: op } = await svc
        .from("delivery_operators")
        .select("owner_user_id, company_name, contact_email")
        .eq("id", rate.operator_id)
        .maybeSingle();
      if (op?.owner_user_id) {
        await svc.from("notifications").insert({
          user_id: op.owner_user_id,
          type: "operator_rate_rejected",
          title: "Tarif refusé",
          message: `Votre tarif pour ${rate.zone_name} (${rate.city}) a été refusé. Raison : ${reason}`,
          link: "/operator/rates",
        });
      }
      // Phase 7 — email opérateur
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASS");
      const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
      const to = op?.contact_email;
      if (smtpHost && smtpUser && smtpPass && fromEmail && to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        const escapedReason = String(reason).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;color:#111;">
            <h2 style="margin:0 0 16px;color:#b91c1c;">Tarif refusé</h2>
            <p>Bonjour <strong>${op?.company_name ?? ""}</strong>,</p>
            <p>Votre tarif pour <strong>${rate.zone_name}</strong> (${rate.city}) n'a pas été approuvé.</p>
            <div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin:16px 0;border-radius:4px;">
              <p style="margin:0;color:#7f1d1d;"><strong>Raison :</strong> ${escapedReason}</p>
            </div>
            <p>Vous pouvez ajuster vos prix puis soumettre un nouveau tarif depuis votre espace.</p>
            <p><a href="https://zandofy.com/operator/rates" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Mettre à jour mes tarifs</a></p>
            <p style="color:#888;font-size:12px;margin-top:32px;">Email automatique — plateforme Zandofy.</p>
          </div>
        `;
        await sendEmail({          to,
          subject: `Zandofy — Tarif refusé (${rate.city} / ${rate.zone_name})`,
          html,
        });
      }
    } catch (e) {
      console.warn("[admin-reject-operator-rate] notif failed", e);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[admin-reject-operator-rate] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}