/**
 * operator-remind-rider-kyc — Lot 11B Phase B3
 *
 * Permet à l'opérateur (ou un admin) de relancer un livreur dont le KYC
 * n'est pas encore validé. Throttle 24h via `last_kyc_reminder_at`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  rider_id: z.string().uuid(),
});

const THROTTLE_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const reqId = crypto.randomUUID();
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

    let raw: unknown = null;
    try { raw = await req.json(); } catch { return json({ error: "Body JSON invalide" }, 400); }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    const { rider_id } = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    // Charge le rattachement
    const { data: rider, error: riderErr } = await svc
      .from("delivery_operator_riders")
      .select("id, operator_id, rider_user_id, status, last_kyc_reminder_at")
      .eq("id", rider_id)
      .maybeSingle();
    if (riderErr || !rider) return json({ error: "Livreur introuvable" }, 404);
    if (!["pending", "kyc_required"].includes(rider.status)) {
      return json({ error: "Le KYC de ce livreur n'est plus en attente" }, 409);
    }

    // Auth : owner de l'opérateur OU admin
    const { data: roleRows } = await svc
      .from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roleRows ?? []).some((r: { role: string }) => r.role === "admin");

    const { data: op } = await svc
      .from("delivery_operators")
      .select("id, company_name, owner_user_id")
      .eq("id", rider.operator_id)
      .maybeSingle();
    if (!op) return json({ error: "Opérateur introuvable" }, 404);
    if (!isAdmin && op.owner_user_id !== userId) {
      return json({ error: "Forbidden" }, 403);
    }

    // Throttle 24h
    if (rider.last_kyc_reminder_at) {
      const lastMs = new Date(rider.last_kyc_reminder_at).getTime();
      const ageMs = Date.now() - lastMs;
      if (ageMs < THROTTLE_HOURS * 3600 * 1000) {
        const remainMin = Math.ceil((THROTTLE_HOURS * 3600 * 1000 - ageMs) / 60000);
        return json({
          error: `Rappel déjà envoyé récemment. Réessayez dans ~${Math.ceil(remainMin / 60)} h.`,
        }, 429);
      }
    }

    // Récup email + prénom du livreur
    const { data: profile } = await svc
      .from("profiles")
      .select("email, first_name")
      .eq("id", rider.rider_user_id)
      .maybeSingle();
    if (!profile?.email) return json({ error: "Email du livreur introuvable" }, 404);

    const ctaUrl = "https://zandofy.com/onboarding";
    const greet = profile.first_name ? `Bonjour ${escapeHtml(profile.first_name)},` : "Bonjour,";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;color:#111;">
        <h2 style="margin:0 0 16px;color:#0f172a;">Rappel : finalisez votre KYC livreur</h2>
        <p>${greet}</p>
        <p><strong>${escapeHtml(op.company_name)}</strong> attend la validation de votre identité pour vous activer comme livreur sur Zandofy.</p>
        <p>Quelques minutes suffisent : pièce d'identité (recto/verso) + selfie.</p>
        <p><a href="${ctaUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Compléter mon KYC</a></p>
        <p style="color:#888;font-size:12px;margin-top:32px;">Email envoyé automatiquement par Zandofy à la demande de votre opérateur.</p>
      </div>
    `;

    const result = await sendEmail({
      to: profile.email,
      subject: `Zandofy — Rappel KYC livreur (${op.company_name})`,
      html,
    });
    if (!result.ok) {
      return json({ error: result.error || `Email non envoyé (HTTP ${result.status})` }, 502);
    }

    await svc
      .from("delivery_operator_riders")
      .update({ last_kyc_reminder_at: new Date().toISOString() })
      .eq("id", rider_id);

    return json({ success: true, request_id: reqId, message: "Rappel envoyé au livreur." }, 200);
  } catch (e: unknown) {
    console.error(`[operator-remind-rider-kyc:${reqId}] error`, e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}