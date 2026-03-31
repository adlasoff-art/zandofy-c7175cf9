import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const KELPAY_CHECK_URL = "https://pay.keccel.com/kelpay/v1/checktransaction.asp";
const KECCEL_CARD_CHECK_URL = "https://pay.keccel.com/kelpay/v1/checktransaction.asp";

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
    const mobileMoneyMerchantCode = Deno.env.get("KELPAY_MERCHANT_CODE");
    const mobileMoneyToken = Deno.env.get("KELPAY_TOKEN");
    const cardMerchantCode = Deno.env.get("KECCEL_CARD_MERCHANT_CODE");
    const cardToken = Deno.env.get("KECCEL_CARD_TOKEN") || mobileMoneyToken;

    // Verify user
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

    const body = await req.json();
    const { transaction_id, reference } = body;

    if (!transaction_id && !reference) {
      return new Response(
        JSON.stringify({ error: "Missing transaction_id or reference" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Look up the transaction from our DB
    let kelpayTransactionId = transaction_id;
    let localTx: any = null;

    if (reference) {
      const { data: txData } = await supabaseAdmin
        .from("payment_transactions")
        .select("id, order_id, status, transaction_id, method")
        .eq("reference", reference)
        .maybeSingle();

      localTx = txData;

      // If already finalized, return immediately
      if (localTx && (localTx.status === "success" || localTx.status === "failed")) {
        return new Response(
          JSON.stringify({ status: localTx.status, reference }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (localTx?.transaction_id) {
        kelpayTransactionId = localTx.transaction_id;
      }
    }

    // If we still have no transaction_id to check, return pending
    if (!kelpayTransactionId) {
      return new Response(
        JSON.stringify({ status: "pending", reference }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which merchant code and token to use based on payment method
    const isCardPayment = localTx?.method === "card";
    const merchantCode = isCardPayment ? (cardMerchantCode || mobileMoneyMerchantCode) : mobileMoneyMerchantCode;
    const merchantToken = isCardPayment ? cardToken : mobileMoneyToken;
    const checkUrl = isCardPayment ? KECCEL_CARD_CHECK_URL : KELPAY_CHECK_URL;

    if (!merchantCode || !merchantToken) {
      return new Response(
        JSON.stringify({ error: "Payment credentials not configured for " + (isCardPayment ? "card" : "mobile_money") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking ${isCardPayment ? "card" : "mobile_money"} transaction ${kelpayTransactionId} with merchant ${merchantCode}`);

    // Call Keccel CheckTransaction
    const checkResponse = await fetch(checkUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${merchantToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchantcode: merchantCode,
        transactionid: kelpayTransactionId,
      }),
    });

    const checkData = await checkResponse.json();
    console.log("Keccel check response:", JSON.stringify(checkData));

    // Determine status from response
    const isSuccess =
      checkData.code === "0" ||
      checkData.transactionstatus === "SUCCESS" ||
      checkData.transactionstatus === "Successful";
    const isFailed =
      (checkData.code === "1" && checkData.transactionstatus === "FAILED") ||
      checkData.transactionstatus === "Failed";

    const normalizedStatus = isSuccess ? "success" : isFailed ? "failed" : "pending";

    // Update local transaction if we got a definitive result
    if ((isSuccess || isFailed) && localTx && localTx.status !== "success") {
      await supabaseAdmin
        .from("payment_transactions")
        .update({
          status: normalizedStatus,
          callback_payload: checkData,
        })
        .eq("id", localTx.id);

      // Update order status
      if (localTx.order_id) {
        if (isSuccess) {
          const { data: orderData } = await supabaseAdmin
            .from("orders")
            .select("status")
            .eq("id", localTx.order_id)
            .maybeSingle();

          if (orderData && ["awaiting_payment", "pending"].includes(orderData.status)) {
            const { error: orderUpdateError } = await supabaseAdmin
              .from("orders")
              .update({ status: "pending" })
              .eq("id", localTx.order_id)
              .in("status", ["awaiting_payment", "pending"]);

            if (!orderUpdateError) {
              await fetch(`${supabaseUrl}/functions/v1/notify-order-status`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${serviceRoleKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ orderId: localTx.order_id, newStatus: "pending" }),
              }).catch(console.error);
            }
          }
        } else if (isFailed) {
          const { data: orderData } = await supabaseAdmin
            .from("orders")
            .select("status")
            .eq("id", localTx.order_id)
            .maybeSingle();

          if (orderData && ["awaiting_payment"].includes(orderData.status)) {
            await supabaseAdmin
              .from("orders")
              .update({ status: "payment_failed" })
              .eq("id", localTx.order_id)
              .eq("status", "awaiting_payment");
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ status: normalizedStatus, reference, kelpay: checkData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("KelPay check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
