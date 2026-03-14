import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KELPAY_URL = "https://pay.keccel.com/kelpay/v1/payment.asp";

function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("243") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return digits;
  if (!digits.startsWith("0") && !digits.startsWith("243") && digits.length === 9) return "0" + digits;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const merchantCode = Deno.env.get("KELPAY_MERCHANT_CODE");
    const merchantToken = Deno.env.get("KELPAY_TOKEN");

    if (!merchantCode || !merchantToken) {
      return new Response(
        JSON.stringify({ error: "KelPay credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user via getUser (correct Supabase method)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { order_id, phone_number, amount, currency, provider } = body;

    if (!order_id || !phone_number || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: order_id, phone_number, amount, currency" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = normalizePhone(phone_number);
    if (!cleanPhone) {
      return new Response(
        JSON.stringify({ error: "Numéro de téléphone invalide. Format attendu : 0XXXXXXXXX ou 243XXXXXXXXX (RDC)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanAmount = Math.round(Number(amount) * 100) / 100;
    const reference = `ZPY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/kelpay-callback`;

    console.log("KelPay request:", JSON.stringify({
      merchantcode: merchantCode,
      mobilenumber: cleanPhone,
      reference,
      amount: String(cleanAmount),
      currency: currency.toUpperCase(),
      callbackurl: callbackUrl,
    }));

    const kelpayResponse = await fetch(KELPAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${merchantToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchantcode: merchantCode,
        mobilenumber: cleanPhone,
        reference,
        amount: String(cleanAmount),
        currency: currency.toUpperCase(),
        description: `Paiement commande Zandofy - ${order_id}`,
        callbackurl: callbackUrl,
      }),
    });

    const kelpayData = await kelpayResponse.json();
    console.log("KelPay response:", JSON.stringify(kelpayData));

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (kelpayData.code === "0") {
      await supabaseAdmin.from("payment_transactions").insert({
        order_id,
        user_id: userId,
        method: "mobile_money",
        provider: provider || null,
        phone_number: cleanPhone,
        amount: cleanAmount,
        currency: currency.toUpperCase(),
        reference,
        transaction_id: kelpayData.transactionid,
        status: "pending",
      });

      await supabaseAdmin
        .from("orders")
        .update({ payment_method: "mobile_money" })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: true,
          reference,
          transaction_id: kelpayData.transactionid,
          message: kelpayData.description,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      await supabaseAdmin.from("payment_transactions").insert({
        order_id,
        user_id: userId,
        method: "mobile_money",
        provider: provider || null,
        phone_number: cleanPhone,
        amount: cleanAmount,
        currency: currency.toUpperCase(),
        reference,
        status: "failed",
        callback_payload: kelpayData,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: kelpayData.description || "Payment request rejected",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("KelPay payment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
