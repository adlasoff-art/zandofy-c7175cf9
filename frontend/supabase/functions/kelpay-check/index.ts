import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KELPAY_CHECK_URL = "https://pay.keccel.com/kelpay/v1/checktransaction.asp";

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
    const { transaction_id } = body;

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: "Missing transaction_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call KelPay CheckTransaction
    const checkResponse = await fetch(KELPAY_CHECK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${merchantToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchantcode: merchantCode,
        transactionid: transaction_id,
      }),
    });

    const checkData = await checkResponse.json();

    // Update local transaction if we got a result
    if (checkData.reference) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const isSuccess =
        checkData.code === "0" || checkData.transactionstatus === "SUCCESS";
      const isFailed =
        checkData.code === "1" || checkData.transactionstatus === "FAILED";

      if (isSuccess || isFailed) {
        const newStatus = isSuccess ? "success" : "failed";

        const { data: tx } = await supabaseAdmin
          .from("payment_transactions")
          .select("id, order_id, status")
          .eq("reference", checkData.reference)
          .maybeSingle();

        if (tx && tx.status === "pending") {
          await supabaseAdmin
            .from("payment_transactions")
            .update({
              status: newStatus,
              callback_payload: checkData,
            })
            .eq("id", tx.id);

          if (isSuccess) {
            await supabaseAdmin
              .from("orders")
              .update({ status: "confirmed" })
              .eq("id", tx.order_id)
              .eq("status", "pending");
          } else {
            await supabaseAdmin
              .from("orders")
              .update({ status: "payment_failed" })
              .eq("id", tx.order_id)
              .eq("status", "pending");
          }
        }
      }
    }

    return new Response(JSON.stringify(checkData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("KelPay check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
