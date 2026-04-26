/**
 * notify-operator-new-order — Lot 11B Phase B4
 *
 * Notifie l'owner d'un opérateur de livraison qu'une commande lui a été
 * attribuée au checkout (`orders.delivery_operator_id`).
 *
 * Auth : utilisateur connecté (le client qui vient de passer commande).
 * Vérifie : la commande existe, lui appartient, contient un delivery_operator_id.
 * Insère : une notification in-app pour `delivery_operators.owner_user_id`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  order_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
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

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json(
        { error: "Invalid input", details: parsed.error.flatten() },
        400,
      );
    }
    const { order_id } = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    // Récupération commande + opérateur
    const { data: order, error: orderErr } = await svc
      .from("orders")
      .select(
        "id, order_ref, user_id, delivery_operator_id, shipping_city, total, last_mile_fee",
      )
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) return json({ error: "Commande introuvable" }, 404);
    if (order.user_id !== userId) {
      return json({ error: "Forbidden" }, 403);
    }
    if (!order.delivery_operator_id) {
      // Pas d'opérateur attribué : flotte plateforme — rien à notifier ici.
      return json({ ok: true, skipped: "no_operator" });
    }

    const { data: op, error: opErr } = await svc
      .from("delivery_operators")
      .select("owner_user_id, company_name")
      .eq("id", order.delivery_operator_id)
      .maybeSingle();
    if (opErr || !op) return json({ error: "Opérateur introuvable" }, 404);

    const orderRef = order.order_ref || order.id.slice(0, 8);
    const fee = Number(order.last_mile_fee || 0).toFixed(2);

    const { error: notifErr } = await svc.from("notifications").insert({
      user_id: op.owner_user_id,
      type: "info",
      title: "🚚 Nouvelle commande à livrer",
      message: `Commande ${orderRef} (${order.shipping_city || "—"}) vous a été attribuée. Frais : $${fee}.`,
      link: "/operator/orders",
    });
    if (notifErr) {
      console.error("[notify-operator-new-order] insert failed:", notifErr);
      return json({ error: "Notification failed" }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("[notify-operator-new-order] error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}