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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Cutoffs adaptés au mode de paiement :
    //  - Mobile Money : 6 min  (3 min KelPay + 3 min de grâce — comportement historique)
    //  - Carte / PayPal / Stripe : 15 min (le client doit saisir ses infos sur la
    //    passerelle Mastercard/Keccel, ça prend plus de temps qu'un push USSD)
    //  - off_platform : 24 h  (validation manuelle vendeur — ne pas expirer agressivement)
    const now = Date.now();
    const cutoffMM = new Date(now - 6 * 60 * 1000).toISOString();
    const cutoffCard = new Date(now - 15 * 60 * 1000).toISOString();
    const cutoffOffPlatform = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredOrders, error: selectError } = await supabase
      .from("orders")
      .select("id, order_ref, user_id, payment_method, created_at")
      .eq("status", "awaiting_payment")
      .or(
        `and(payment_method.eq.mobile_money,created_at.lt.${cutoffMM}),` +
        `and(payment_method.in.(card,paypal,stripe),created_at.lt.${cutoffCard}),` +
        `and(payment_method.eq.off_platform,created_at.lt.${cutoffOffPlatform})`
      );

    if (selectError) {
      console.error("Error finding expired orders:", selectError);
      return new Response(JSON.stringify({ error: selectError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      return new Response(JSON.stringify({ expired: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = expiredOrders.map((o) => o.id);

    // Update all expired orders to payment_failed
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "payment_failed" })
      .in("id", ids);

    if (updateError) {
      console.error("Error updating expired orders:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify each user
    const notifications = expiredOrders.map((o) => ({
      user_id: o.user_id,
      type: "order",
      title: "Paiement expiré",
      message: `Le paiement de votre commande ${o.order_ref} n'a pas été confirmé à temps. Vous pouvez relancer le paiement depuis votre espace en quelques clics.`,
      link: "/dashboard",
    }));

    await supabase.from("notifications").insert(notifications);

    // Update related payment_transactions
    await supabase
      .from("payment_transactions")
      .update({ status: "failed" })
      .in("order_id", ids)
      .eq("status", "pending");

    console.log(`Expired ${ids.length} orders:`, ids);

    return new Response(
      JSON.stringify({ expired: ids.length, order_ids: ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("expire-pending-orders error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
