import { createClient } from "npm:@supabase/supabase-js@2";

async function computeHmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-kelpay-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("KELPAY_WEBHOOK_SECRET");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rawBody = await req.text();

    // Verify HMAC signature if webhook secret is configured
    if (webhookSecret) {
      const signature = req.headers.get("x-kelpay-signature") || req.headers.get("X-KelPay-Signature");
      if (signature) {
        const expectedHex = await computeHmacSha256(webhookSecret, rawBody);
        const expected = `sha256=${expectedHex}`;
        if (signature !== expected && signature !== expectedHex) {
          console.error("Invalid webhook signature");
          return new Response("Invalid signature", { status: 401, headers: corsHeaders });
        }
      }
    }

    const payload = JSON.parse(rawBody);
    console.log("KelPay webhook received:", JSON.stringify(payload));

    const {
      code,
      reference,
      transactionid,
      transactionstatus,
      description,
      amount,
      currency,
    } = payload;

    if (!reference) {
      console.warn("KelPay webhook: no reference in payload");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Check if this is a subscription payment (reference starts with SUB)
    const isSubscription = reference.startsWith("SUB");

    if (isSubscription) {
      // Handle subscription payment
      const { data: subTx, error: subErr } = await supabase
        .from("subscription_payments")
        .select("id, user_id, status, subscription_type, package_id, service_key, store_id, billing_cycle, amount")
        .eq("reference", reference)
        .maybeSingle();

      if (subErr || !subTx) {
        console.error("Subscription payment not found for ref:", reference, subErr);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      if (subTx.status === "success") {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const subIsSuccess = code === "0" || code === 0 || transactionstatus === "SUCCESS" || transactionstatus === "Successful";
      const subFailedStatuses = ["FAILED", "Failed", "Cancelled", "CANCELLED", "Expired", "EXPIRED", "Declined", "DECLINED", "Rejected", "REJECTED"];
      const subIsFailed = subFailedStatuses.includes(transactionstatus) || (code !== "0" && code !== 0 && code !== "1" && code !== undefined && code !== null);

      if (!subIsSuccess && !subIsFailed) {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const subNewStatus = subIsSuccess ? "success" : "failed";
      await supabase.from("subscription_payments").update({
        status: subNewStatus,
        transaction_id: transactionid || undefined,
        callback_payload: payload,
      }).eq("id", subTx.id);

      if (subIsSuccess) {
        // Activate the subscription
        const paidUntil = new Date();
        if (subTx.billing_cycle === "yearly") {
          paidUntil.setFullYear(paidUntil.getFullYear() + 1);
        } else {
          paidUntil.setMonth(paidUntil.getMonth() + 1);
        }

        if (subTx.subscription_type === "package" && subTx.package_id && subTx.store_id) {
          // Deactivate old subscription
          await supabase.from("store_package_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("store_id", subTx.store_id)
            .eq("is_active", true);

          // Create new subscription
          await supabase.from("store_package_subscriptions").insert({
            store_id: subTx.store_id,
            package_id: subTx.package_id,
            billing_cycle: subTx.billing_cycle,
            paid_until: paidUntil.toISOString(),
            is_active: true,
            subscribed_at: new Date().toISOString(),
          });
        } else if (subTx.subscription_type === "service" && subTx.service_key && subTx.store_id) {
          // Activate individual service
          const { data: vs } = await supabase.from("vendor_subscriptions")
            .select("id, active_services")
            .eq("store_id", subTx.store_id)
            .maybeSingle();

          const newServices = { ...(vs?.active_services as Record<string, boolean> || {}), [subTx.service_key]: true };

          if (vs?.id) {
            await supabase.from("vendor_subscriptions").update({
              active_services: newServices,
              service_paid_until: paidUntil.toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", vs.id);
          } else {
            await supabase.from("vendor_subscriptions").insert({
              store_id: subTx.store_id,
              active_services: newServices,
              service_paid_until: paidUntil.toISOString(),
            });
          }
        }

        // Notification
        if (subTx.user_id) {
          await supabase.from("notifications").insert({
            user_id: subTx.user_id,
            type: "payment",
            title: "Abonnement activé",
            message: `Votre abonnement a été activé avec succès. Montant : $${subTx.amount}.`,
            link: "/vendor",
          });
        }
      } else if (subIsFailed && subTx.user_id) {
        await supabase.from("notifications").insert({
          user_id: subTx.user_id,
          type: "payment",
          title: "Paiement abonnement échoué",
          message: `Votre paiement d'abonnement a échoué. ${description || "Veuillez réessayer."}`,
          link: "/vendor",
        });
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // === Regular order payment flow ===

    // Find the payment transaction by reference
    const { data: tx, error: txErr } = await supabase
      .from("payment_transactions")
      .select("id, order_id, status, payment_type, amount, user_id, method")
      .eq("reference", reference)
      .maybeSingle();

    if (txErr || !tx) {
      console.error("Payment transaction not found for reference:", reference, txErr);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Don't reprocess if already successful
    if (tx.status === "success") {
      console.log("Transaction already successful, skipping:", reference);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const isSuccess =
      code === "0" || code === 0 ||
      transactionstatus === "SUCCESS" ||
      transactionstatus === "Successful";

    const failedStatuses = [
      "FAILED", "Failed", "Cancelled", "CANCELLED", "Expired", "EXPIRED",
      "Declined", "DECLINED", "Rejected", "REJECTED",
    ];
    const isFailed =
      failedStatuses.includes(transactionstatus) ||
      (code !== "0" && code !== 0 && code !== "1" && code !== undefined && code !== null);

    const newStatus = isSuccess ? "success" : isFailed ? "failed" : "pending";

    // Only update if we got a definitive result
    if (!isSuccess && !isFailed) {
      console.log("KelPay webhook: non-definitive status, ignoring:", payload);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Update payment transaction
    await supabase
      .from("payment_transactions")
      .update({
        status: newStatus,
        transaction_id: transactionid || undefined,
        callback_payload: payload,
      })
      .eq("id", tx.id);

    // Update order status
    if (isSuccess) {
      const paymentType = tx.payment_type || "order";

      if (paymentType === "order") {
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ status: "pending" })
          .eq("id", tx.order_id)
          .in("status", ["awaiting_payment", "pending"]);

        if (!orderUpdateError) {
          await fetch(`${supabaseUrl}/functions/v1/notify-order-status`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId: tx.order_id, newStatus: "pending" }),
          }).catch(console.error);
        }
      } else if (paymentType === "shipping") {
        await supabase
          .from("orders")
          .update({ shipping_payment_status: "paid" })
          .eq("id", tx.order_id);
      } else if (paymentType === "last_mile") {
        await supabase
          .from("orders")
          .update({ last_mile_payment_status: "paid" })
          .eq("id", tx.order_id);
      }

      // Notification in-app
      if (tx.user_id) {
        await supabase.from("notifications").insert({
          user_id: tx.user_id,
          type: "payment",
          title: "Paiement confirmé",
          message: `Votre paiement de ${tx.amount} a été confirmé avec succès.`,
          link: "/dashboard",
        });
      }
    } else if (isFailed) {
      const { data: orderData } = await supabase
        .from("orders")
        .select("status")
        .eq("id", tx.order_id)
        .maybeSingle();

      if (orderData && ["awaiting_payment"].includes(orderData.status)) {
        await supabase
          .from("orders")
          .update({ status: "payment_failed" })
          .eq("id", tx.order_id)
          .eq("status", "awaiting_payment");
      }

      if (tx.user_id) {
        await supabase.from("notifications").insert({
          user_id: tx.user_id,
          type: "payment",
          title: "Paiement échoué",
          message: `Votre paiement a échoué. ${description || "Veuillez réessayer."}`,
          link: "/dashboard",
        });
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("KelPay webhook error:", error);
    // Always return OK to avoid KelPay retries
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
