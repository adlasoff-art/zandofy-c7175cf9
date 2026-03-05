import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;
    const { orderId, format } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), { status: 400, headers: corsHeaders });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
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

    const invoiceDate = new Date(order.created_at).toLocaleDateString("fr-FR");
    const itemsHtml = (items || []).map((item: any) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.product_name}${item.size ? ` (${item.size})` : ""}${item.color ? ` - ${item.color}` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${Number(item.price).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${(Number(item.price) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Facture ${order.order_ref}</title></head>
    <body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:40px;">
        <div>
          <h1 style="color:#1a5c2e;margin:0;font-size:28px;">ZANDOFY</h1>
          <p style="color:#666;margin:4px 0;">E-commerce Platform</p>
        </div>
        <div style="text-align:right;">
          <h2 style="margin:0;color:#1a5c2e;">FACTURE</h2>
          <p style="margin:4px 0;font-size:14px;"><strong>N°</strong> ${order.order_ref}</p>
          <p style="margin:4px 0;font-size:14px;"><strong>Date:</strong> ${invoiceDate}</p>
        </div>
      </div>

      <div style="background:#f8f8f8;padding:16px;border-radius:8px;margin-bottom:24px;">
        <h3 style="margin:0 0 8px;font-size:14px;color:#666;">DESTINATAIRE</h3>
        <p style="margin:2px 0;"><strong>${order.shipping_first_name || ""} ${order.shipping_last_name || ""}</strong></p>
        <p style="margin:2px 0;">${order.shipping_address || ""}</p>
        <p style="margin:2px 0;">${order.shipping_city || ""}, ${order.shipping_country || ""}</p>
        ${order.shipping_phone ? `<p style="margin:2px 0;">Tél: ${order.shipping_phone}</p>` : ""}
        ${order.shipping_email ? `<p style="margin:2px 0;">Email: ${order.shipping_email}</p>` : ""}
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#1a5c2e;color:white;">
            <th style="padding:10px;text-align:left;">Article</th>
            <th style="padding:10px;text-align:center;">Qté</th>
            <th style="padding:10px;text-align:right;">P.U.</th>
            <th style="padding:10px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;">
        <table style="width:250px;">
          <tr><td style="padding:4px;">Sous-total</td><td style="padding:4px;text-align:right;">$${Number(order.subtotal).toFixed(2)}</td></tr>
          <tr><td style="padding:4px;">Livraison</td><td style="padding:4px;text-align:right;">${Number(order.shipping_cost) === 0 ? "Gratuit" : "$" + Number(order.shipping_cost).toFixed(2)}</td></tr>
          ${order.discount_amount ? `<tr><td style="padding:4px;color:#1a5c2e;">Réduction${order.coupon_code ? ` (${order.coupon_code})` : ""}</td><td style="padding:4px;text-align:right;color:#1a5c2e;">-$${Number(order.discount_amount).toFixed(2)}</td></tr>` : ""}
          <tr style="font-weight:bold;border-top:2px solid #1a5c2e;"><td style="padding:8px 4px;">TOTAL</td><td style="padding:8px 4px;text-align:right;color:#1a5c2e;font-size:18px;">$${Number(order.total).toFixed(2)}</td></tr>
        </table>
      </div>

      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#999;font-size:12px;">
        <p>Merci pour votre commande sur Zandofy !</p>
        <p>Pour toute question, contactez-nous à support@zandofy.com</p>
      </div>
    </body>
    </html>
    `;

    // If PDF format requested, return HTML for client-side PDF generation
    // The client will use window.print() or a library to generate the PDF
    if (format === "pdf") {
      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="facture-${order.order_ref}.html"`,
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
