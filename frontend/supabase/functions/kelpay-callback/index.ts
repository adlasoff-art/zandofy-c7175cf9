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
      .select("id, order_id, status, payment_type, amount")
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
      const paymentType = tx.payment_type || "order";
      const txAmount = tx.amount ? Number(tx.amount) : undefined;

      if (paymentType === "order") {
        // Standard order payment
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ status: "pending" })
          .eq("id", tx.order_id)
          .in("status", ["awaiting_payment", "pending"]);

        if (orderUpdateError) {
          console.error("Order update after KelPay success failed:", orderUpdateError);
        } else {
          await fetch(`${supabaseUrl}/functions/v1/notify-order-status`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId: tx.order_id, newStatus: "pending" }),
          }).catch((notifyError) => {
            console.error("Failed to trigger order notification after KelPay success:", notifyError);
          });
        }
      } else if (paymentType === "shipping") {
        // Shipping payment
        await supabase
          .from("orders")
          .update({ shipping_payment_status: "paid" })
          .eq("id", tx.order_id);

        await fetch(`${supabaseUrl}/functions/v1/notify-order-status`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId: tx.order_id, newStatus: "shipping_payment_success", amount: txAmount }),
        }).catch((notifyError) => {
          console.error("Failed to trigger shipping payment notification:", notifyError);
        });
      } else if (paymentType === "last_mile") {
        // Last-mile delivery payment
        await supabase
          .from("orders")
          .update({ last_mile_payment_status: "paid" })
          .eq("id", tx.order_id);

        await fetch(`${supabaseUrl}/functions/v1/notify-order-status`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId: tx.order_id, newStatus: "last_mile_payment_success", amount: txAmount }),
        }).catch((notifyError) => {
          console.error("Failed to trigger last-mile payment notification:", notifyError);
        });
      }
    } else {
      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({ status: "payment_failed" })
        .eq("id", tx.order_id)
        .in("status", ["awaiting_payment", "pending"]);

      if (orderUpdateError) {
        console.error("Order update after KelPay failure failed:", orderUpdateError);
      }
    }

    // Respond with OK as required by KelPay
    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("KelPay callback error:", error);
    // Always return OK to KelPay to avoid retries
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
