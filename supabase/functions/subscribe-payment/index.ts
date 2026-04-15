import { createClient } from "npm:@supabase/supabase-js@2";

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
    const siteBaseUrl = Deno.env.get("SITE_BASE_URL");
    const keccelToken = Deno.env.get("KELPAY_TOKEN");
    const keccelMerchantCode = Deno.env.get("KECCEL_CARD_MERCHANT_CODE") || "jam";

    if (!siteBaseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Configuration serveur incomplète (SITE_BASE_URL)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      payment_method, // "card" | "mobile_money"
      store_id,
      subscription_type, // "package" | "service"
      package_id,
      service_key,
      billing_cycle, // "monthly" | "yearly"
      amount,
      item_name,
      phone_number,
      provider: momoProvider,
    } = body;

    // Validate required fields
    if (!payment_method || !amount || amount <= 0) {
      return new Response(JSON.stringify({ success: false, error: "Paramètres invalides" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["card", "mobile_money"].includes(payment_method)) {
      return new Response(JSON.stringify({ success: false, error: "Méthode de paiement non autorisée pour les abonnements. Carte ou Mobile Money uniquement." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `SUB${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 22)}`;

    // Create subscription payment record
    const { data: subPayment, error: insertErr } = await supabase
      .from("subscription_payments")
      .insert({
        user_id: user.id,
        store_id: store_id || null,
        payment_method,
        provider: payment_method === "card" ? "keccel" : (momoProvider || "kelpay"),
        amount,
        currency: "USD",
        reference,
        status: "pending",
        billing_cycle: billing_cycle || "monthly",
        subscription_type: subscription_type || "package",
        package_id: package_id || null,
        service_key: service_key || null,
        phone_number: payment_method === "mobile_money" ? phone_number : null,
      })
      .select("id")
      .single();

    if (insertErr || !subPayment) {
      console.error("Error creating subscription payment:", insertErr);
      return new Response(JSON.stringify({ success: false, error: "Erreur lors de la création du paiement" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CARD PAYMENT (Keccel CardPay) ===
    if (payment_method === "card") {
      const returnUrl = `${siteBaseUrl}/payment/return?ref=${encodeURIComponent(reference)}&sub_payment_id=${subPayment.id}`;
      const callbackUrl = `${supabaseUrl}/functions/v1/kelpay-webhook`;

      const keccelPayload = {
        merchantcode: keccelMerchantCode,
        reference,
        amount,
        currency: "USD",
        description: `Abonnement ${item_name || subscription_type} - Zandofy`,
        callbackurl: callbackUrl,
        returnUrl,
      };

      try {
        const resp = await fetch("https://api.keccel.net/cardpay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${keccelToken}`,
          },
          body: JSON.stringify(keccelPayload),
        });

        const keccelResponse = await resp.json();
        console.log("Keccel subscription response:", JSON.stringify(keccelResponse));

        if (String(keccelResponse?.code) !== "0") {
          await supabase.from("subscription_payments").update({ status: "failed", callback_payload: keccelResponse }).eq("id", subPayment.id);
          return new Response(JSON.stringify({
            success: false,
            error: keccelResponse?.description || "Erreur de la passerelle de paiement",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("subscription_payments").update({
          transaction_id: keccelResponse?.transactionid || null,
          callback_payload: keccelResponse,
        }).eq("id", subPayment.id);

        return new Response(JSON.stringify({
          success: true,
          payment_id: subPayment.id,
          redirect_url: keccelResponse?.checkoutUrl || null,
          reference,
          status: "pending",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      } catch (apiError) {
        console.error("Keccel API error:", apiError);
        return new Response(JSON.stringify({ success: false, error: "Erreur de connexion à la passerelle" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === MOBILE MONEY PAYMENT (KelPay) ===
    if (payment_method === "mobile_money") {
      if (!phone_number) {
        return new Response(JSON.stringify({ success: false, error: "Numéro de téléphone requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/kelpay-webhook`;

      const kelpayPayload = {
        merchantcode: keccelMerchantCode,
        reference,
        phone: phone_number,
        amount,
        currency: "USD",
        description: `Abonnement ${item_name || subscription_type} - Zandofy`,
        callbackurl: callbackUrl,
      };

      try {
        const resp = await fetch("https://api.keccel.net/kelpay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${keccelToken}`,
          },
          body: JSON.stringify(kelpayPayload),
        });

        const kelpayResponse = await resp.json();
        console.log("KelPay subscription response:", JSON.stringify(kelpayResponse));

        if (String(kelpayResponse?.code) !== "0") {
          await supabase.from("subscription_payments").update({ status: "failed", callback_payload: kelpayResponse }).eq("id", subPayment.id);
          return new Response(JSON.stringify({
            success: false,
            error: kelpayResponse?.description || "Erreur Mobile Money",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("subscription_payments").update({
          transaction_id: kelpayResponse?.transactionid || null,
          callback_payload: kelpayResponse,
        }).eq("id", subPayment.id);

        return new Response(JSON.stringify({
          success: true,
          payment_id: subPayment.id,
          transaction_id: kelpayResponse?.transactionid || null,
          reference,
          status: "pending",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      } catch (apiError) {
        console.error("KelPay API error:", apiError);
        return new Response(JSON.stringify({ success: false, error: "Erreur de connexion Mobile Money" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: false, error: "Méthode non supportée" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("subscribe-payment error:", error);
    return new Response(JSON.stringify({ success: false, error: "Erreur serveur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
