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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/**
 * mark-payment-abandoned
 * Called by the client when:
 *  - the user closes the tab / navigates away while a payment is pending
 *  - the in-page countdown reaches zero and no manual verification happened
 *
 * Performs a final KelPay verification when a reference is provided. If the
 * payment is still pending (or unknown), transitions the matching orders to
 * `payment_failed` and notifies the user. If KelPay reports success, leaves
 * the orders alone (a separate webhook will finalize them).
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const orderIds: string[] = Array.isArray(body?.order_ids) ? body.order_ids : [];
    const reference: string | null = body?.reference ?? null;

    if (orderIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "order_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Best-effort final check with KelPay before failing
    let kelpayStatus: string | null = null;
    if (reference) {
      try {
        const checkRes = await supabase.functions.invoke("kelpay-check", {
          body: { reference },
        });
        kelpayStatus = (checkRes.data as any)?.status ?? null;
      } catch (e) {
        console.warn("kelpay-check failed during abandonment:", e);
      }
    }

    if (kelpayStatus === "success") {
      // Payment actually went through — do nothing destructive.
      return new Response(
        JSON.stringify({ aborted: true, reason: "payment_success" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch orders still awaiting_payment among the provided list
    const { data: orders, error: selectError } = await supabase
      .from("orders")
      .select("id, order_ref, user_id")
      .in("id", orderIds)
      .eq("status", "awaiting_payment");

    if (selectError) {
      console.error("select orders failed:", selectError);
      return new Response(JSON.stringify({ error: selectError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = orders.map((o) => o.id);

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "payment_failed" })
      .in("id", ids);

    if (updateError) {
      console.error("update orders failed:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark related transactions as failed
    await supabase
      .from("payment_transactions")
      .update({ status: "failed" })
      .in("order_id", ids)
      .eq("status", "pending");

    // Notify each user once
    const notifications = orders.map((o) => ({
      user_id: o.user_id,
      type: "order",
      title: "Paiement non confirmé",
      message: `Le paiement de votre commande ${o.order_ref} n'a pas abouti. Vous pouvez relancer en quelques clics depuis votre espace.`,
      link: "/dashboard",
    }));
    await supabase.from("notifications").insert(notifications);

    return new Response(
      JSON.stringify({ failed: ids.length, order_ids: ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("mark-payment-abandoned error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
