/**
 * Lot 11B Phase 6 — Notify admins by email when an operator submits a new rate
 *
 * Appelée juste après l'INSERT d'un tarif par un opérateur tiers.
 * Envoie un email aux admins/managers pour les inviter à valider le tarif.
 * Le trigger DB notify_admins_new_operator_rate s'occupe des notifs in-app.
 *
 * Auth: requiert un JWT valide (l'opérateur authentifié).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = [
    "https://studio.zandofy.com",
    "https://zandofy.com",
    "https://www.zandofy.com",
  ];
  const isAllowed =
    allowed.includes(origin) ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com") ||
    origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rateId } = await req.json();
    if (!rateId) {
      return new Response(JSON.stringify({ error: "rateId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load rate + operator
    const { data: rate } = await svc
      .from("delivery_operator_rates")
      .select("*")
      .eq("id", rateId)
      .maybeSingle();
    if (!rate) {
      return new Response(JSON.stringify({ error: "Rate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: operator } = await svc
      .from("delivery_operators")
      .select("id, company_name, owner_user_id, is_platform_owned")
      .eq("id", rate.operator_id)
      .maybeSingle();
    if (!operator) {
      return new Response(JSON.stringify({ error: "Operator not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Defense — only the operator owner can trigger this
    if (operator.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip auto-approved (Very Speed Delivery)
    if (operator.is_platform_owned || rate.status !== "pending") {
      return new Response(JSON.stringify({ success: true, skipped: "not_pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve admin/manager emails
    const { data: adminRoles } = await svc
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);
    const adminIds = (adminRoles ?? []).map((r: any) => r.user_id);
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: "no_admins" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profiles } = await svc
      .from("profiles")
      .select("user_id, email")
      .in("user_id", adminIds);
    const recipients = (profiles ?? [])
      .map((p: any) => p.email)
      .filter((e: string) => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: "no_emails" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SMTP
    const subject = `Zandofy — Tarif opérateur à valider (${operator.company_name})`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;color:#111;">
        <h2 style="margin:0 0 16px;color:#0f172a;">Nouveau tarif à valider</h2>
        <p>Un opérateur de livraison vient de soumettre un nouveau tarif et attend votre validation.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:6px 0;color:#666;">Opérateur</td><td style="padding:6px 0;"><strong>${operator.company_name}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Ville</td><td style="padding:6px 0;">${rate.city} (${rate.country_code})</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Zone</td><td style="padding:6px 0;">${rate.zone_name}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Prix de base</td><td style="padding:6px 0;"><strong>${rate.base_price} ${rate.currency}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Surcharge</td><td style="padding:6px 0;">${rate.surcharge} ${rate.currency}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Délai estimé</td><td style="padding:6px 0;">${rate.estimated_minutes} min</td></tr>
        </table>
        <p><a href="https://zandofy.com/admin/operator-rates-pending" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Valider ou refuser</a></p>
        <p style="color:#888;font-size:12px;margin-top:32px;">Email automatique — plateforme Zandofy.</p>
      </div>
    `;

    await sendEmail({      to: Deno.env.get("SMTP_FROM_EMAIL") || "noreply@zandofy.com",
      bcc: recipients,
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true, recipients: recipients.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[notify-admin-operator-rate] error", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});