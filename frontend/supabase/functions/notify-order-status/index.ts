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

// ─── Status templates ───
const NOTIFY_STATUSES: Record<string, { subject: string; heading: string; body: string; emoji: string }> = {
  pending: {
    subject: "🧾 Confirmation de commande",
    heading: "Votre commande a bien été enregistrée !",
    body: "Nous avons bien reçu votre paiement et votre commande est maintenant en attente de traitement par le vendeur.",
    emoji: "🧾",
  },
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
  shipping_payment_success: {
    subject: "💳 Paiement expédition confirmé",
    heading: "Votre paiement d'expédition a été confirmé !",
    body: "Le paiement pour l'expédition de votre commande a bien été reçu. Votre colis sera bientôt en route.",
    emoji: "💳",
  },
  last_mile_payment_success: {
    subject: "💳 Paiement livraison confirmé",
    heading: "Votre paiement de livraison à domicile a été confirmé !",
    body: "Le paiement pour la livraison à domicile de votre commande a bien été reçu. Un livreur sera assigné prochainement.",
    emoji: "💳",
  },
  off_platform_validated: {
    subject: "✅ Paiement hors plateforme validé",
    heading: "Votre paiement a été validé !",
    body: "Le vendeur a confirmé la réception de votre paiement hors plateforme. Votre commande est en cours de traitement.",
    emoji: "✅",
  },
};

// ─── Branding types ───
interface Branding {
  email_logo_url?: string | null;
  email_signature_name?: string;
  email_signature_address?: string;
  email_signature_phone?: string;
  email_signature_email?: string;
  email_signature_website?: string;
  email_signature_extra?: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  color?: string | null;
  size?: string | null;
}

// ─── Build branded email HTML ───
function buildEmailHtml(
  heading: string,
  body: string,
  orderRef: string,
  emoji: string,
  branding: Branding,
  items?: OrderItem[],
  order?: { subtotal: number; shipping_cost: number; discount_amount?: number | null; total: number; payment_method?: string | null },
  amount?: number,
) {
  const siteUrl = Deno.env.get("SITE_BASE_URL") || "https://zandofy.com";
  const companyName = branding.email_signature_name || "Zandofy";

  const logoBlock = branding.email_logo_url
    ? `<tr><td style="padding:24px 32px 0;" align="center">
         <img src="${branding.email_logo_url}" alt="${companyName}" style="max-height:60px;max-width:200px;" />
       </td></tr>`
    : `<tr><td style="padding:24px 32px 0;" align="center">
         <h2 style="margin:0;font-size:24px;font-weight:700;color:#000;">${companyName}</h2>
       </td></tr>`;

  // Signature block
  const sigParts: string[] = [];
  if (branding.email_signature_address) sigParts.push(branding.email_signature_address);
  if (branding.email_signature_phone) sigParts.push(`Tél : ${branding.email_signature_phone}`);
  if (branding.email_signature_email) sigParts.push(branding.email_signature_email);
  if (branding.email_signature_website) sigParts.push(`<a href="${branding.email_signature_website}" style="color:#888;text-decoration:underline;">${branding.email_signature_website}</a>`);
  if (branding.email_signature_extra) sigParts.push(`<em>${branding.email_signature_extra}</em>`);

  const signatureBlock = `
    <tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#333;">${companyName}</p>
      <p style="margin:0;font-size:11px;color:#999;line-height:1.6;">${sigParts.join(" · ")}</p>
    </td></tr>`;

  // Amount block
  const amountBlock = amount != null
    ? `<table cellpadding="0" cellspacing="0" style="background:#e8f5e9;border-radius:8px;width:100%;margin-bottom:16px;">
        <tr><td style="padding:16px;">
          <p style="margin:0;font-size:12px;color:#388e3c;">Montant payé</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#1b5e20;">$${amount.toFixed(2)}</p>
        </td></tr>
      </table>`
    : "";

  // Items table (for detailed confirmation)
  let itemsBlock = "";
  if (items && items.length > 0 && order) {
    const rows = items.map((it) => {
      const variant = [it.size, it.color].filter(Boolean).join(" / ");
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">
          ${it.product_name}${variant ? ` <span style="color:#999;">(${variant})</span>` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:center;">×${it.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:right;">$${(it.price * it.quantity).toFixed(2)}</td>
      </tr>`;
    }).join("");

    const discountRow = order.discount_amount && order.discount_amount > 0
      ? `<tr>
          <td colspan="2" style="padding:4px 0;font-size:13px;color:#388e3c;">Réduction</td>
          <td style="padding:4px 0;font-size:13px;color:#388e3c;text-align:right;">-$${order.discount_amount.toFixed(2)}</td>
        </tr>`
      : "";

    itemsBlock = `
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
        <tr>
          <th style="padding:8px 0;border-bottom:2px solid #000;font-size:12px;color:#888;text-align:left;">Article</th>
          <th style="padding:8px 0;border-bottom:2px solid #000;font-size:12px;color:#888;text-align:center;">Qté</th>
          <th style="padding:8px 0;border-bottom:2px solid #000;font-size:12px;color:#888;text-align:right;">Prix</th>
        </tr>
        ${rows}
        <tr>
          <td colspan="2" style="padding:4px 0;font-size:13px;color:#666;">Sous-total</td>
          <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">$${order.subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:4px 0;font-size:13px;color:#666;">Frais de livraison</td>
          <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">$${order.shipping_cost.toFixed(2)}</td>
        </tr>
        ${discountRow}
        <tr>
          <td colspan="2" style="padding:8px 0;border-top:2px solid #000;font-size:15px;font-weight:bold;color:#000;">Total</td>
          <td style="padding:8px 0;border-top:2px solid #000;font-size:15px;font-weight:bold;color:#000;text-align:right;">$${order.total.toFixed(2)}</td>
        </tr>
      </table>
      ${order.payment_method ? `<p style="margin:0 0 16px;font-size:12px;color:#888;">Mode de paiement : <strong>${order.payment_method}</strong></p>` : ""}`;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        ${logoBlock}
        <tr><td style="padding:24px 32px 0;">
          <p style="font-size:40px;margin:0 0 8px;">${emoji}</p>
          <h1 style="margin:0 0 12px;font-size:22px;color:#1a1a1a;">${heading}</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">${body}</p>
          ${amountBlock}
          ${itemsBlock}
          <table cellpadding="0" cellspacing="0" style="background:#f1f3f5;border-radius:8px;width:100%;margin-bottom:24px;">
            <tr><td style="padding:16px;">
              <p style="margin:0;font-size:12px;color:#888;">Référence commande</p>
              <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#1a1a1a;font-family:monospace;">${orderRef}</p>
            </td></tr>
          </table>
          <a href="${siteUrl}/tracking" style="display:inline-block;padding:12px 28px;background:#000;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Suivre ma commande</a>
        </td></tr>
        ${signatureBlock}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, newStatus, amount } = await req.json();

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

    // Get order details (with items)
    const { data: order } = await supabase
      .from("orders")
      .select("order_ref, user_id, shipping_email, shipping_first_name, subtotal, shipping_cost, discount_amount, total, payment_method")
      .eq("id", orderId)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order items for detailed confirmation
    let items: OrderItem[] = [];
    if (newStatus === "pending" || newStatus === "off_platform_validated") {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_name, quantity, price, color, size")
        .eq("order_id", orderId);
      if (orderItems) items = orderItems;
    }

    // Fetch branding config
    let branding: Branding = {};
    try {
      const { data: brandingRow } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "branding")
        .maybeSingle();
      if (brandingRow?.value) branding = brandingRow.value as Branding;
    } catch {
      // Use defaults
    }

    const results: Record<string, any> = { inApp: false, email: false, push: false };

    // 1. In-app notification (via DB)
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: order.user_id,
      type: "order",
      title: template.subject,
      message: `${template.body} (Réf: ${order.order_ref})`,
      link: "/tracking",
    });
    if (notificationError) {
      console.error("Notification insert error:", notificationError);
    } else {
      results.inApp = true;
    }

    // 2. Email notification via SMTP

    const recipientEmail = order.shipping_email;

    if (smtpHost && smtpUser && smtpPass && fromEmail && recipientEmail) {
      try {

        const includeDetails = newStatus === "pending" || newStatus === "off_platform_validated";

        await sendEmail({          to: recipientEmail,
          subject: `${template.subject} — ${order.order_ref}`,
          html: buildEmailHtml(
            template.heading,
            template.body,
            order.order_ref,
            template.emoji,
            branding,
            includeDetails ? items : undefined,
            includeDetails ? order : undefined,
            amount,
          ),
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
