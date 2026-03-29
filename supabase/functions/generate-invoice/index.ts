import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }).auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Commande introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order items
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    // Fetch store info
    let storeName = "Zandofy";
    if (order.store_id) {
      const { data: store } = await supabase
        .from("stores")
        .select("name")
        .eq("id", order.store_id)
        .single();
      if (store) storeName = store.name;
    }

    // Fetch rider info
    let riderName = "";
    if (order.assigned_rider_name) {
      riderName = order.assigned_rider_name;
    } else if (order.assigned_driver_name) {
      riderName = order.assigned_driver_name;
    }

    const orderDate = new Date(order.created_at).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const subtotal = Number(order.subtotal || 0);
    const shippingCost = Number(order.shipping_cost || 0);
    const lastMileFee = Number(order.last_mile_fee || 0);
    const discount = Number(order.discount_amount || 0);
    const tipAmount = Number(order.tip_amount || 0);
    const total = Number(order.total || 0);

    const itemRows = (items || [])
      .map(
        (item: any) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;">
          ${item.product_name || "Article"}
          ${item.color ? `<br><span style="color:#888;font-size:11px;">Couleur: ${item.color}</span>` : ""}
          ${item.size ? `<br><span style="color:#888;font-size:11px;">Taille: ${item.size}</span>` : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;">$${Number(item.price).toFixed(2)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-weight:600;">$${(Number(item.price) * item.quantity).toFixed(2)}</td>
      </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${order.order_ref}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; background: #f5f5f5; }
    .invoice { max-width: 800px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a1a, #333); color: white; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header .invoice-label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 4px; }
    .header .invoice-ref { font-size: 18px; font-weight: 600; }
    .content { padding: 30px 40px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px; }
    .info-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
    .info-block p { font-size: 13px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #f8f9fa; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; text-align: left; border-bottom: 2px solid #e5e7eb; }
    thead th:nth-child(2), thead th:nth-child(3), thead th:nth-child(4) { text-align: center; }
    thead th:last-child { text-align: right; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 280px; }
    .totals-table .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .totals-table .row.total { border-top: 2px solid #333; padding-top: 10px; margin-top: 6px; font-size: 16px; font-weight: 700; }
    .totals-table .row.discount { color: #16a34a; }
    .footer { background: #f8f9fa; padding: 20px 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; }
    @media print {
      body { background: white; }
      .invoice { box-shadow: none; margin: 0; border-radius: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <h1>ZANDOFY</h1>
        <p style="font-size:12px;opacity:0.7;margin-top:4px;">Marketplace panafricaine</p>
      </div>
      <div style="text-align:right;">
        <div class="invoice-label">Facture</div>
        <div class="invoice-ref">${order.order_ref}</div>
        <p style="font-size:12px;opacity:0.7;margin-top:4px;">${orderDate}</p>
      </div>
    </div>

    <div class="content">
      <div class="info-grid">
        <div class="info-block">
          <h3>Destinataire</h3>
          <p>
            <strong>${order.shipping_first_name || ""} ${order.shipping_last_name || ""}</strong><br>
            ${order.shipping_address ? `${order.shipping_address}<br>` : ""}
            ${order.shipping_city || ""} ${order.shipping_postal_code || ""}<br>
            ${order.shipping_country || ""}<br>
            ${order.shipping_phone ? `Tél: ${order.shipping_phone}<br>` : ""}
            ${order.shipping_email ? `Email: ${order.shipping_email}` : ""}
          </p>
        </div>
        <div class="info-block">
          <h3>Détails</h3>
          <p>
            <strong>Boutique :</strong> ${storeName}<br>
            <strong>Statut :</strong> ${order.status}<br>
            <strong>Paiement :</strong> ${order.payment_method || "N/A"}<br>
            ${riderName ? `<strong>Livreur :</strong> ${riderName}<br>` : ""}
            ${order.tracking_number ? `<strong>Tracking :</strong> ${order.tracking_number}` : ""}
          </p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Article</th>
            <th style="text-align:center;">Qté</th>
            <th style="text-align:right;">P.U.</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-table">
          <div class="row"><span>Sous-total</span><span>$${subtotal.toFixed(2)}</span></div>
          <div class="row"><span>Frais d'expédition</span><span>$${shippingCost.toFixed(2)}</span></div>
          ${lastMileFee > 0 ? `<div class="row"><span>Livraison dernier km</span><span>$${lastMileFee.toFixed(2)}</span></div>` : ""}
          ${discount > 0 ? `<div class="row discount"><span>Réduction</span><span>-$${discount.toFixed(2)}</span></div>` : ""}
          ${tipAmount > 0 ? `<div class="row"><span>Pourboire</span><span>$${tipAmount.toFixed(2)}</span></div>` : ""}
          <div class="row total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Merci pour votre achat sur Zandofy · Cette facture a été générée automatiquement</p>
      <p style="margin-top:4px;">Pour toute question, contactez-nous à support@zandofy.com</p>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin:20px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#333;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;">
      🖨️ Imprimer / Télécharger PDF
    </button>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur interne" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
