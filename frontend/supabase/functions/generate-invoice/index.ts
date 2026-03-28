import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = user.id;
    const { orderId, format } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), { status: 400, headers: corsHeaders });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_ref, created_at, status, user_id, subtotal, shipping_cost, total, discount_amount, coupon_code, payment_method, shipping_first_name, shipping_last_name, shipping_address, shipping_city, shipping_country, shipping_postal_code, shipping_phone, shipping_email, delivery_choice, last_mile_fee, confirmation_code, assigned_rider_name, tracking_number, shipping_payment_status, last_mile_payment_status")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: corsHeaders });
    }

    if (order.user_id !== userId) {
      const { data: roles } = await supabase.rpc("get_user_roles", { _user_id: userId });
      const isStaff = roles?.includes("admin") || roles?.includes("manager");
      if (!isStaff) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity, price, size, color")
      .eq("order_id", orderId);

    const invoiceDate = new Date(order.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const invoiceTime = new Date(order.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const statusLabels: Record<string, string> = {
      pending: "En attente", confirmed: "Confirmée", processing: "En préparation",
      in_transit: "En expédition", shipped: "Arrivée au Hub", assigning_rider: "Attribution livreur",
      rider_assigned: "Livreur assigné", out_for_delivery: "En livraison", delivered: "Livrée",
      cancelled: "Annulée",
    };

    const itemsHtml = (items || []).map((item: any) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:13px;">${item.product_name}${item.size ? ` <span style="color:#888;">(${item.size})</span>` : ""}${item.color ? ` <span style="color:#888;">- ${item.color}</span>` : ""}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:center;font-size:13px;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-size:13px;">$${Number(item.price).toFixed(2)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-size:13px;font-weight:600;">$${(Number(item.price) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

    const deliveryLabel = order.delivery_choice === "home_delivery" ? "Livraison à domicile" : order.delivery_choice === "hub_pickup" ? "Retrait au Hub" : "—";
    const paymentLabel = order.payment_method === "mobile_money" ? "Mobile Money" : order.payment_method === "cash_on_delivery" ? "Paiement à la livraison" : order.payment_method || "—";

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Facture ${order.order_ref} - Zandofy</title>
      <style>
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #1a5c2e; }
        .logo-section h1 { color: #1a5c2e; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
        .logo-section p { color: #888; margin: 4px 0 0; font-size: 13px; }
        .invoice-meta { text-align: right; }
        .invoice-meta h2 { margin: 0; color: #1a5c2e; font-size: 22px; letter-spacing: 2px; }
        .invoice-meta p { margin: 3px 0; font-size: 13px; color: #555; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .info-box { background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e8e8e8; }
        .info-box h3 { margin: 0 0 10px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .info-box p { margin: 2px 0; font-size: 13px; }
        .info-box strong { color: #333; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #1a5c2e; color: white; }
        thead th { padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
        .totals table { width: 280px; }
        .totals td { padding: 6px 12px; font-size: 13px; }
        .total-row { font-weight: bold; border-top: 2px solid #1a5c2e; }
        .total-row td { padding: 10px 12px; font-size: 16px; color: #1a5c2e; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e8e8e8; text-align: center; color: #aaa; font-size: 11px; }
        .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          <h1>ZANDOFY</h1>
          <p>La marketplace africaine</p>
          <p style="font-size:11px;color:#aaa;">www.zandofy.com</p>
        </div>
        <div class="invoice-meta">
          <h2>FACTURE</h2>
          <p><strong>N°</strong> ${order.order_ref}</p>
          <p><strong>Date :</strong> ${invoiceDate} à ${invoiceTime}</p>
          <p><strong>Statut :</strong> <span class="status-badge" style="background:#e8f5e9;color:#1a5c2e;">${statusLabels[order.status] || order.status}</span></p>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h3>Destinataire</h3>
          <p><strong>${order.shipping_first_name || ""} ${order.shipping_last_name || ""}</strong></p>
          <p>${order.shipping_address || ""}</p>
          <p>${order.shipping_city || ""}${order.shipping_postal_code ? ", " + order.shipping_postal_code : ""}, ${order.shipping_country || ""}</p>
          ${order.shipping_phone ? `<p>📞 ${order.shipping_phone}</p>` : ""}
          ${order.shipping_email ? `<p>✉️ ${order.shipping_email}</p>` : ""}
        </div>
        <div class="info-box">
          <h3>Informations commande</h3>
          <p><strong>Paiement :</strong> ${paymentLabel}</p>
          <p><strong>Mode de livraison :</strong> ${deliveryLabel}</p>
          ${order.tracking_number ? `<p><strong>N° de suivi :</strong> ${order.tracking_number}</p>` : ""}
          ${order.confirmation_code ? `<p><strong>Code confirmation :</strong> ${order.confirmation_code}</p>` : ""}
          ${order.assigned_rider_name ? `<p><strong>Livreur :</strong> ${order.assigned_rider_name}</p>` : ""}
          ${order.last_mile_fee ? `<p><strong>Frais dernier km :</strong> $${Number(order.last_mile_fee).toFixed(2)}</p>` : ""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align:left;">Article</th>
            <th style="text-align:center;">Qté</th>
            <th style="text-align:right;">P.U.</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="totals">
        <table>
          <tr><td>Sous-total</td><td style="text-align:right;">$${Number(order.subtotal).toFixed(2)}</td></tr>
          <tr><td>Expédition</td><td style="text-align:right;">${Number(order.shipping_cost) === 0 ? "Gratuit" : "$" + Number(order.shipping_cost).toFixed(2)}</td></tr>
          ${order.last_mile_fee && Number(order.last_mile_fee) > 0 ? `<tr><td>Livraison dernier km</td><td style="text-align:right;">$${Number(order.last_mile_fee).toFixed(2)}</td></tr>` : ""}
          ${order.discount_amount && Number(order.discount_amount) > 0 ? `<tr><td style="color:#1a5c2e;">Réduction${order.coupon_code ? ` (${order.coupon_code})` : ""}</td><td style="text-align:right;color:#1a5c2e;">-$${Number(order.discount_amount).toFixed(2)}</td></tr>` : ""}
          <tr class="total-row"><td>TOTAL TTC</td><td style="text-align:right;">$${Number(order.total).toFixed(2)}</td></tr>
        </table>
      </div>

      <div class="footer">
        <p><strong>Zandofy</strong> — La marketplace africaine</p>
        <p>Pour toute question, contactez-nous à support@zandofy.com</p>
        <p style="margin-top:8px;">Ce document tient lieu de facture. Conservez-le pour vos dossiers.</p>
      </div>

      <div class="no-print" style="text-align:center;margin-top:24px;">
        <button onclick="window.print()" style="background:#1a5c2e;color:white;border:none;padding:10px 24px;border-radius:6px;font-size:14px;cursor:pointer;font-weight:600;">
          🖨️ Imprimer / Enregistrer en PDF
        </button>
      </div>
    </body>
    </html>
    `;

    if (format === "pdf") {
      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return new Response(JSON.stringify({ html, orderRef: order.order_ref }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
