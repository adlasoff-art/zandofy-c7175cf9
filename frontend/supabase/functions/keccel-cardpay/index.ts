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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteBaseUrl = Deno.env.get("SITE_BASE_URL") || "https://studio.zandofy.com";
    const keccelToken = Deno.env.get("KELPAY_TOKEN");
    const keccelMerchantCode = Deno.env.get("KECCEL_CARD_MERCHANT_CODE") || "jam";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { order_id, payment_method, payment_type, save_card } = body;

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const method = payment_method || "card"; // card or paypal

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_ref, user_id, total, subtotal, shipping_cost, status, last_mile_fee")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Commande introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Cette commande ne vous appartient pas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine amount based on payment_type
    const pType = payment_type || "order";
    let amount: number;
    if (pType === "shipping") {
      amount = Number(order.shipping_cost) || 0;
    } else if (pType === "last_mile") {
      amount = Number(order.last_mile_fee) || 0;
    } else {
      amount = Number(order.total) || 0;
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Montant invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `keccel_${method}_${order.id}_${Date.now()}`;
    const returnUrl = `${siteBaseUrl}/payment/return?ref=${encodeURIComponent(reference)}&order_id=${order.id}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/kelpay-webhook`;

    // Payload conforme à la doc officielle Keccel CardPay API
    // 7 champs obligatoires : merchantcode, reference, amount, currency, description, callbackurl, returnUrl
    const keccelPayload = {
      merchantcode: keccelMerchantCode,
      reference: reference,
      amount: amount,
      currency: "USD",
      description: `Commande ${order.order_ref} - Zandofy`,
      callbackurl: callbackUrl,
      returnUrl: returnUrl,
    };

    let keccelResponse: any = null;
    let redirectUrl: string | null = null;

    try {
      const resp = await fetch("https://api.keccel.net/cardpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keccelToken}`,
        },
        body: JSON.stringify(keccelPayload),
      });

      keccelResponse = await resp.json();
      console.log("Keccel cardpay response:", JSON.stringify(keccelResponse));

      // Vérifier code === "0" (succès selon la doc)
      if (String(keccelResponse?.code) !== "0") {
        console.error("Keccel API returned error:", keccelResponse);
        return new Response(
          JSON.stringify({
            error: keccelResponse?.description || "Erreur de la passerelle de paiement",
            details: keccelResponse,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // checkoutUrl est le champ de redirection selon la doc officielle
      redirectUrl = keccelResponse?.checkoutUrl || null;
    } catch (apiError) {
      console.error("Keccel API error:", apiError);
      return new Response(
        JSON.stringify({ error: "Erreur de connexion à la passerelle de paiement" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payment transaction record
    const { data: tx, error: txError } = await supabase
      .from("payment_transactions")
      .insert({
        order_id: order.id,
        user_id: user.id,
        method: method === "paypal" ? "paypal" : "card",
        provider: "keccel",
        amount: amount,
        currency: "USD",
        reference: reference.substring(0, 255),
        transaction_id: keccelResponse?.transaction_id || keccelResponse?.id || null,
        status: "pending",
        payment_type: pType,
        callback_payload: keccelResponse,
      })
      .select("id")
      .single();

    if (txError) {
      console.error("Error creating payment transaction:", txError);
      return new Response(
        JSON.stringify({ error: "Erreur interne lors de la création de la transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update order status to awaiting_payment if it's the main order payment
    if (pType === "order") {
      await supabase
        .from("orders")
        .update({ status: "awaiting_payment", payment_method: method === "paypal" ? "paypal" : "card" })
        .eq("id", order.id)
        .in("status", ["pending", "awaiting_payment"]);
    }

    return new Response(
      JSON.stringify({
        transaction_id: tx?.id,
        redirect_url: redirectUrl,
        reference: reference,
        status: "pending",
        // If no redirect URL from Keccel, return the terminal fallback
        fallback_terminal_url: !redirectUrl
          ? `https://terminal.keccel.com/payment.php?m=${keccelMerchantCode}`
          : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("keccel-cardpay error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
