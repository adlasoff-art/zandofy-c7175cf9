import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Statuses that trigger multi-channel notifications
const NOTIFY_STATUSES: Record<string, { subject: string; heading: string; body: string; emoji: string }> = {
  confirmed: {
    subject: "✅ Commande confirmée",
    heading: "Votre commande est confirmée !",
    body: "Le vendeur a accepté votre commande et la prépare.",
    emoji: "✅",
  },
  in_shipping: {
    subject: "🚚 Commande en expédition",
    heading: "Votre commande est en route !",
    body: "Votre colis a été expédié et est en transit vers le hub de destination.",
    emoji: "🚚",
  },
  shipped: {
    subject: "📦 Colis arrivé au hub",
    heading: "Votre colis est arrivé au hub !",
    body: "Votre commande est arrivée au hub local et sera bientôt assignée à un livreur.",
    emoji: "📦",
  },
  out_for_delivery: {
    subject: "🛵 Livraison en cours",
    heading: "Votre colis est en cours de livraison !",
    body: "Le livreur est en route vers votre adresse. Préparez-vous à recevoir votre commande.",
    emoji: "🛵",
  },
  delivered: {
    subject: "🎉 Commande livrée",
    heading: "Votre commande a été livrée !",
    body: "Votre colis a été livré avec succès. Merci pour votre confiance !",
    emoji: "🎉",
  },
};

function buildEmailHtml(heading: string, body: string, orderRef: string, emoji: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="padding:32px 32px 0;">
          <p style="font-size:40px;margin:0 0 8px;">${emoji}</p>
          <h1 style="margin:0 0 12px;font-size:22px;color:#1a1a1a;">${heading}</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">${body}</p>
          <table cellpadding="0" cellspacing="0" style="background:#f1f3f5;border-radius:8px;width:100%;margin-bottom:24px;">
            <tr><td style="padding:16px;">
              <p style="margin:0;font-size:12px;color:#888;">Référence commande</p>
              <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#1a1a1a;font-family:monospace;">${orderRef}</p>
            </td></tr>
          </table>
          <a href="https://zandofy.lovable.app/tracking" style="display:inline-block;padding:12px 28px;background:#000;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Suivre ma commande</a>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#aaa;">Zandofy — Votre marketplace de confiance</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, newStatus } = await req.json();

    if (!orderId || !newStatus) {
      return new Response(JSON.stringify({ error: "Missing orderId or newStatus" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = NOTIFY_STATUSES[newStatus];
    if (!template) {
      return new Response(JSON.stringify({ skipped: true, reason: "Status not in notify list" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get order details
    const { data: order } = await supabase
      .from("orders")
      .select("order_ref, user_id, shipping_email, shipping_first_name")
      .eq("id", orderId)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = { inApp: false, email: false, push: false };

    // 1. In-app notification (via DB)
    await supabase.from("notifications").insert({
      user_id: order.user_id,
      type: "order",
      title: template.subject,
      message: `${template.body} (Réf: ${order.order_ref})`,
      link: "/tracking",
    });
    results.inApp = true;

    // 2. Email notification via SMTP
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");

    const recipientEmail = order.shipping_email;

    if (smtpHost && smtpUser && smtpPass && fromEmail && recipientEmail) {
      try {
        const transport = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transport.sendMail({
          from: fromEmail,
          to: recipientEmail,
          subject: `${template.subject} — ${order.order_ref}`,
          html: buildEmailHtml(template.heading, template.body, order.order_ref, template.emoji),
        });
        results.email = true;
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    }

    // 3. Push notification
    const { data: pushSubs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", order.user_id);

    if (pushSubs && pushSubs.length > 0) {
      // Push subs exist — actual Web Push sending requires VAPID keys
      // For now mark as attempted
      results.push = { subscriptions: pushSubs.length, attempted: true };
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-order-status error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
