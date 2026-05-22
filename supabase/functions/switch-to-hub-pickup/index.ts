/**
 * switch-to-hub-pickup — Lot H4
 *
 * Permet à un client de basculer une commande de "livraison à domicile" vers
 * "retrait à l'agence" à la dernière minute, tant qu'aucun coursier n'est
 * encore en route (status <= rider_assigned).
 *
 * Auth : owner de la commande uniquement.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SWITCHABLE_STATUSES = new Set([
  "shipped",
  "arrived_at_hub",
  "at_hub",
  "assigning_rider",
  "rider_assigned",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.order_id === "string" ? body.order_id : null;
    if (!orderId) return json({ error: "order_id required" }, 400);

    const svc = createClient(supabaseUrl, serviceKey);

    const { data: order, error: orderErr } = await svc
      .from("orders")
      .select("id, user_id, status, delivery_choice, delivery_operator_id, pickup_code, order_ref")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) return json({ error: orderErr.message }, 500);
    if (!order) return json({ error: "order_not_found" }, 404);
    if (order.user_id !== userId) return json({ error: "Forbidden" }, 403);

    if (order.delivery_choice === "hub_pickup") {
      return json({ ok: true, already: true, pickup_code: order.pickup_code });
    }
    if (!SWITCHABLE_STATUSES.has(order.status)) {
      return json({ error: "too_late", message: "La livraison est déjà en cours, vous ne pouvez plus basculer." }, 409);
    }

    // Generate pickup_code if missing
    let pickupCode = order.pickup_code as string | null;
    if (!pickupCode) {
      pickupCode = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    }

    const { error: updErr } = await svc
      .from("orders")
      .update({
        delivery_choice: "hub_pickup",
        status: "ready_for_pickup",
        delivery_operator_id: null,
        operator_acceptance_status: null,
        operator_assigned_at: null,
        operator_response_deadline: null,
        assigned_rider_id: null,
        assigned_rider_name: null,
        pickup_code: pickupCode,
        pickup_code_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updErr) return json({ error: updErr.message }, 500);

    // Notify previously assigned operator if any
    if (order.delivery_operator_id) {
      const { data: op } = await svc
        .from("delivery_operators")
        .select("owner_user_id, company_name")
        .eq("id", order.delivery_operator_id)
        .maybeSingle();
      if (op?.owner_user_id) {
        await svc.from("notifications").insert({
          user_id: op.owner_user_id,
          type: "delivery",
          title: "Commande annulée",
          message: `Le client a finalement choisi de récupérer la commande ${order.order_ref} à l'agence.`,
          link: "/operator/orders",
        });
      }
    }

    // Notify the customer with their pickup code
    await svc.from("notifications").insert({
      user_id: userId,
      type: "order",
      title: "Retrait au hub confirmé",
      message: `Votre code de retrait pour ${order.order_ref} : ${pickupCode}. Présentez-le à l'agence.`,
      link: "/dashboard/orders",
    });

    return json({ ok: true, pickup_code: pickupCode });
  } catch (e: any) {
    return json({ error: e?.message ?? "internal_error" }, 500);
  }
});
