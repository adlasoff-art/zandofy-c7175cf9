import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with items
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(`
        id, order_ref, status, subtotal, total, shipping_cost, discount_amount,
        payment_method, shipping_first_name, shipping_last_name, shipping_phone,
        shipping_email, shipping_address, shipping_city, shipping_commune,
        shipping_country, shipping_province, shipping_postal_code,
        delivery_option, delivery_choice, created_at, store_id,
        order_items(id, product_name, product_image, quantity, price, color, size, product_id)
      `)
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if store has a webhook URL configured
    if (!order.store_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No store associated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: override } = await supabase
      .from("vendor_pricing_overrides")
      .select("vendor_webhook_url")
      .eq("store_id", order.store_id)
      .single();

    const webhookUrl = (override as any)?.vendor_webhook_url;
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No webhook URL configured for this store" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send webhook
    const payload = {
      event: "order.created",
      timestamp: new Date().toISOString(),
      order: {
        id: order.id,
        ref: order.order_ref,
        status: order.status,
        subtotal: order.subtotal,
        total: order.total,
        shipping_cost: order.shipping_cost,
        discount: order.discount_amount,
        payment_method: order.payment_method,
        delivery_option: order.delivery_option,
        delivery_choice: order.delivery_choice,
        created_at: order.created_at,
        customer: {
          first_name: order.shipping_first_name,
          last_name: order.shipping_last_name,
          phone: order.shipping_phone,
          email: order.shipping_email,
        },
        shipping: {
          address: order.shipping_address,
          city: order.shipping_city,
          commune: order.shipping_commune,
          province: order.shipping_province,
          country: order.shipping_country,
          postal_code: order.shipping_postal_code,
        },
        items: (order as any).order_items?.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          name: item.product_name,
          image: item.product_image,
          quantity: item.quantity,
          price: item.price,
          color: item.color,
          size: item.size,
        })) || [],
      },
    };

    const webhookResp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log(`Webhook sent to ${webhookUrl} — status: ${webhookResp.status}`);

    return new Response(
      JSON.stringify({
        success: true,
        webhook_status: webhookResp.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("vendor-order-webhook error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
