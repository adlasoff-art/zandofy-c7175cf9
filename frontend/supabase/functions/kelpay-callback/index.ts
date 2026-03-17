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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json();
    console.log("KelPay callback received:", JSON.stringify(payload));

    const { code, reference, transactionid, description } = payload;

    if (!reference) {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Find the payment transaction by reference
    const { data: tx, error: txErr } = await supabase
      .from("payment_transactions")
      .select("id, order_id, status")
      .eq("reference", reference)
      .maybeSingle();

    if (txErr || !tx) {
      console.error("Payment transaction not found for reference:", reference);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Don't process if already successful
    if (tx.status === "success") {
      console.log("Transaction already successful, skipping");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const isSuccess = code === "0" || code === 0;
    const newStatus = isSuccess ? "success" : "failed";

    // Update payment transaction
    await supabase
      .from("payment_transactions")
      .update({
        status: newStatus,
        transaction_id: transactionid || null,
        callback_payload: payload,
      })
      .eq("id", tx.id);

    // Update order status based on payment result
    if (isSuccess) {
      await supabase
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", tx.order_id)
        .eq("status", "pending");
    } else {
      await supabase
        .from("orders")
        .update({ status: "payment_failed" })
        .eq("id", tx.order_id)
        .eq("status", "pending");
    }

    // Respond with OK as required by KelPay
    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("KelPay callback error:", error);
    // Always return OK to KelPay to avoid retries
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
