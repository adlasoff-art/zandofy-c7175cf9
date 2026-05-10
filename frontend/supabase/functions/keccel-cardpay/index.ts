// Keccel CardPay — reference capped at 25 chars for Visa compatibility
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
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  function errorResponse(error: string, details?: any) {
    return new Response(
      JSON.stringify({ success: false, error, ...(details ? { details } : {}) }),
      { status: 200, headers: jsonHeaders }
    );
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteBaseUrl = Deno.env.get("SITE_BASE_URL");
    const keccelToken = Deno.env.get("KELPAY_TOKEN");
    const keccelMerchantCode = Deno.env.get("KECCEL_CARD_MERCHANT_CODE");

    if (!siteBaseUrl) {
      console.error("SITE_BASE_URL is not configured");
      return errorResponse("Configuration serveur incomplète (SITE_BASE_URL)");
    }
    if (!keccelMerchantCode) {
      console.error("KECCEL_CARD_MERCHANT_CODE is not configured");
      return errorResponse("Configuration carte incomplète : merchant code manquant. Contactez le support.");
    }
    if (!keccelToken) {
      console.error("KELPAY_TOKEN is not configured");
      return errorResponse("Configuration carte incomplète : token manquant. Contactez le support.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Non autorisé");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return errorResponse("Non autorisé");
    }

    // Rate limiting: 5 requests/min per user
    const { data: rlAllowed } = await supabase.rpc("check_rate_limit", {
      p_identifier: user.id,
      p_endpoint: "keccel-cardpay",
      p_max_requests: 5,
      p_window_seconds: 60,
    });
    if (rlAllowed === false) {
      return errorResponse("Trop de requêtes. Veuillez patienter.");
    }

    const body = await req.json();
    const { order_id, payment_method, payment_type, save_card } = body;

    if (!order_id) {
      return errorResponse("order_id requis");
    }

    const method = payment_method || "card";

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_ref, user_id, total, subtotal, shipping_cost, status, last_mile_fee")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      return errorResponse("Commande introuvable");
    }

    if (order.user_id !== user.id) {
      return errorResponse("Cette commande ne vous appartient pas");
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
      return errorResponse("Montant invalide");
    }

    // Max 25 chars for Keccel compatibility
    const reference = `KC${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 23)}`;
    const returnUrl = `${siteBaseUrl}/payment/return?ref=${encodeURIComponent(reference)}&order_id=${order.id}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/kelpay-webhook`;

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
      console.log("Keccel cardpay → payload:", JSON.stringify({ ...keccelPayload, merchantcode: "[redacted]" }));
      const resp = await fetch("https://api.keccel.net/cardpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keccelToken}`,
        },
        body: JSON.stringify(keccelPayload),
      });

      const rawBody = await resp.text();
      console.log("Keccel cardpay ← status:", resp.status, "body:", rawBody);
      try {
        keccelResponse = JSON.parse(rawBody);
      } catch (_parseErr) {
        console.error("Keccel cardpay returned non-JSON body");
        return errorResponse(
          `Réponse invalide de la passerelle (HTTP ${resp.status})`,
          { httpStatus: resp.status, body: rawBody.slice(0, 500) }
        );
      }

      if (String(keccelResponse?.code) !== "0") {
        console.error("Keccel API returned error:", keccelResponse);
        return errorResponse(
          `Keccel ${keccelResponse?.code ?? "?"} : ${keccelResponse?.description || "Erreur de la passerelle de paiement"}`,
          keccelResponse
        );
      }

      redirectUrl = keccelResponse?.checkoutUrl || null;
    } catch (apiError) {
      console.error("Keccel API error:", apiError);
      return errorResponse("Erreur de connexion à la passerelle de paiement");
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
        transaction_id: keccelResponse?.transactionid || null,
        status: "pending",
        payment_type: pType,
        callback_payload: keccelResponse,
      })
      .select("id")
      .single();

    if (txError) {
      console.error("Error creating payment transaction:", txError);
      return errorResponse("Erreur interne lors de la création de la transaction");
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
        success: true,
        transaction_id: tx?.id,
        redirect_url: redirectUrl,
        reference: reference,
        status: "pending",
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    console.error("keccel-cardpay error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur serveur" }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
