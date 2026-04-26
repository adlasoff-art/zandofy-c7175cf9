/**
 * expire-operator-assignments — Lot 11B Phase B7
 *
 * Cron-friendly. Marque comme `expired` les commandes pending dont le
 * `operator_response_deadline` est dépassé, détache l'opérateur et
 * journalise l'événement pour réassignation automatique.
 *
 * Auth : verify_jwt = false (appelée par cron / admin tooling).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    const { data: expired, error: selErr } = await svc
      .from("orders")
      .select(
        "id, order_ref, user_id, delivery_operator_id, operator_reassignment_count",
      )
      .eq("operator_acceptance_status", "pending")
      .lt("operator_response_deadline", nowIso);
    if (selErr) throw selErr;

    let processed = 0;
    for (const order of expired || []) {
      // 1) historique
      await svc.from("operator_assignment_history").insert({
        order_id: order.id,
        previous_operator_id: order.delivery_operator_id,
        new_operator_id: null,
        reason: "expired_no_response",
      });

      // 2) détacher + reset
      await svc
        .from("orders")
        .update({
          delivery_operator_id: null,
          operator_acceptance_status: "not_applicable",
          operator_reassignment_count:
            (order.operator_reassignment_count ?? 0) + 1,
        })
        .eq("id", order.id);

      // 3) notif client
      const ref = order.order_ref || order.id.slice(0, 8);
      await svc.from("notifications").insert({
        user_id: order.user_id,
        type: "warning",
        title: "⏳ Réattribution en cours",
        message: `Le transporteur n'a pas répondu pour la commande ${ref}. Nous lui cherchons un remplaçant.`,
        link: `/orders/${order.id}`,
      });

      processed++;
    }

    return json({ ok: true, processed });
  } catch (e) {
    console.error("[expire-operator-assignments] error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}