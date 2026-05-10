/**
 * operator-decide-order — Lot 11B Phase B7
 *
 * Permet à l'owner d'un opérateur de livraison d'accepter ou refuser une
 * commande qui lui a été attribuée. Notifie le client en cas de refus
 * (réassignation déclenchée par un autre process / admin).
 *
 * Auth : utilisateur connecté = owner_user_id de l'opérateur.
 * Body : { order_id: uuid, decision: 'accepted'|'declined', reason?: string }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { clientOperatorReassignedEmail } from "../_shared/operator-email-templates.ts";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  order_id: z.string().uuid(),
  decision: z.enum(["accepted", "declined"]),
  reason: z.string().max(500).optional(),
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

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json(
        { error: "Invalid input", details: parsed.error.flatten() },
        400,
      );
    }
    const { order_id, decision, reason } = parsed.data;

    // Appel RPC SECURITY DEFINER (vérifie ownership et statut pending)
    const { data: rpcData, error: rpcErr } = await userClient.rpc(
      "operator_decide_order",
      { p_order_id: order_id, p_decision: decision, p_reason: reason ?? null },
    );
    if (rpcErr) {
      console.error("[operator-decide-order] RPC error:", rpcErr);
      return json({ error: rpcErr.message }, 400);
    }

    // Notifications post-décision (best-effort) avec service role
    const svc = createClient(supabaseUrl, serviceKey);
    const { data: order } = await svc
      .from("orders")
      .select("id, order_ref, user_id, delivery_operator_id, shipping_city")
      .eq("id", order_id)
      .maybeSingle();

    if (order) {
      const ref = order.order_ref || order.id.slice(0, 8);
      if (decision === "accepted") {
        await svc.from("notifications").insert({
          user_id: order.user_id,
          type: "success",
          title: "✅ Livreur confirmé",
          message: `Le transporteur a accepté votre commande ${ref}. Préparation en cours.`,
          link: `/orders/${order.id}`,
        });
      } else {
        // Marque la commande à réassigner et notifie l'admin
        await svc.from("operator_assignment_history").insert({
          order_id,
          previous_operator_id: order.delivery_operator_id,
          new_operator_id: null,
          reason: `declined_by_operator${reason ? `: ${reason}` : ""}`,
          triggered_by: userData.user.id,
        });
        // Détache l'opérateur pour permettre une nouvelle attribution
        await svc
          .from("orders")
          .update({
            delivery_operator_id: null,
            operator_acceptance_status: "not_applicable",
            operator_reassignment_count:
              ((order as { operator_reassignment_count?: number })
                .operator_reassignment_count ?? 0) + 1,
          })
          .eq("id", order_id);

        await svc.from("notifications").insert({
          user_id: order.user_id,
          type: "warning",
          title: "⏳ Recherche d'un transporteur",
          message: `Le transporteur initial n'est pas disponible pour la commande ${ref}. Nous cherchons un autre opérateur.`,
          link: `/orders/${order.id}`,
        });

        // Email client (best-effort)
        await sendClientReassignmentEmail(svc, order.user_id, ref, order.id);
      }
    }

    return json({ ok: true, decision, rpc: rpcData });
  } catch (e) {
    console.error("[operator-decide-order] error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendClientReassignmentEmail(
  svc: ReturnType<typeof createClient>,
  userId: string,
  orderRef: string,
  orderId: string,
) {
  try {
    const { data: profile } = await svc
      .from("profiles")
      .select("email, first_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.email ) {
      return;
    }
    const greeting = profile.first_name ? `Bonjour ${profile.first_name},` : "Bonjour,";
    const html = clientOperatorReassignedEmail({
      greeting,
      orderRef,
      orderId,
      cause: "declined",
    });
    await sendEmail({      to: profile.email,
      subject: `🔄 Nouveau transporteur pour votre commande ${orderRef}`,
      html,
    });
  } catch (err) {
    console.error("[operator-decide-order] client email failed:", err);
  }
}