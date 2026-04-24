/**
 * Lot 4I — Notify forwarder handoff
 *
 * Appelée juste après la création d'une commande internationale (et la
 * consommation du devis freight). Envoie un email au transitaire pour
 * l'informer qu'une nouvelle expédition est à traiter.
 *
 * Le handoff lui-même (table forwarder_handoffs) et la notification in-app
 * sont créés automatiquement par le trigger DB côté Supabase.
 *
 * Auth: requiert un JWT valide (user authentifié — propriétaire de la commande).
 */
import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const { handoffId, orderId } = await req.json();
    if (!handoffId && !orderId) {
      return new Response(JSON.stringify({ error: "handoffId or orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client to read forwarder contact email + order details
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve handoff
    let handoffQuery = svc.from("forwarder_handoffs").select("*").limit(1);
    handoffQuery = handoffId
      ? handoffQuery.eq("id", handoffId)
      : handoffQuery.eq("order_id", orderId);
    const { data: handoffRows, error: hErr } = await handoffQuery;
    if (hErr || !handoffRows || handoffRows.length === 0) {
      return new Response(JSON.stringify({ error: "Handoff not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const handoff = handoffRows[0] as any;

    // Verify caller is the order owner (extra defense — RLS already enforces)
    const { data: order } = await svc
      .from("orders")
      .select("id, order_ref, user_id, shipping_country, shipping_city, total")
      .eq("id", handoff.order_id)
      .maybeSingle();
    if (!order || order.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forwarder contact
    const { data: forwarder } = await svc
      .from("forwarders")
      .select("id, name, contact_email")
      .eq("id", handoff.forwarder_id)
      .maybeSingle();
    if (!forwarder?.contact_email || !EMAIL_REGEX.test(forwarder.contact_email)) {
      // No email configured — silently skip (in-app notif still delivered by trigger)
      return new Response(JSON.stringify({ success: true, skipped: "no_contact_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SMTP config
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = handoff.notification_payload ?? {};
    const subject = `Zandofy — Nouvelle expédition à traiter (commande ${order.order_ref ?? order.id})`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;color:#111;">
        <h2 style="margin:0 0 16px;color:#0f172a;">Nouvelle expédition Zandofy</h2>
        <p>Bonjour <strong>${forwarder.name}</strong>,</p>
        <p>Une nouvelle commande vient de vous être assignée pour prise en charge logistique.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:6px 0;color:#666;">Référence</td><td style="padding:6px 0;"><strong>${order.order_ref ?? order.id}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Destination</td><td style="padding:6px 0;">${order.shipping_city ?? ""} ${order.shipping_country ?? ""}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Colis</td><td style="padding:6px 0;">${payload.pieces_count ?? "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Poids</td><td style="padding:6px 0;">${payload.weight_kg ?? "—"} kg</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Volume</td><td style="padding:6px 0;">${payload.cbm ?? "—"} m³</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Devis verrouillé</td><td style="padding:6px 0;"><strong>${payload.quoted_price ?? "—"} ${payload.currency ?? ""}</strong></td></tr>
        </table>
        <p>Connectez-vous à votre espace transitaire pour confirmer la prise en charge :</p>
        <p><a href="https://zandofy.com/forwarder" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Accéder à mes commandes</a></p>
        <p style="color:#888;font-size:12px;margin-top:32px;">Cet email vous a été envoyé automatiquement par la plateforme Zandofy.</p>
      </div>
    `;

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transport.sendMail({ from: fromEmail, to: forwarder.contact_email, subject, html });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[notify-forwarder-handoff] error", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});