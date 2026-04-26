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
import nodemailer from "npm:nodemailer@6.9.16";

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
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    if (!profile?.email || !smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      return;
    }
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    const greeting = profile.first_name ? `Bonjour ${profile.first_name},` : "Bonjour,";
    const html = buildClientReassignmentHtml(greeting, orderRef, orderId, "declined");
    await transport.sendMail({
      from: fromEmail,
      to: profile.email,
      subject: `🔄 Nouveau transporteur pour votre commande ${orderRef}`,
      html,
    });
  } catch (err) {
    console.error("[operator-decide-order] client email failed:", err);
  }
}

function buildClientReassignmentHtml(
  greeting: string,
  orderRef: string,
  orderId: string,
  cause: "declined" | "expired",
) {
  const reason =
    cause === "declined"
      ? "Le transporteur initialement attribué n'est pas disponible."
      : "Le transporteur n'a pas confirmé la prise en charge dans le délai imparti.";
  return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#16a34a;padding:24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">🔄 Recherche d'un transporteur</h1>
        </td></tr>
        <tr><td style="padding:32px 28px;color:#1f2937;">
          <p style="font-size:16px;margin:0 0 16px;">${greeting}</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">${reason}</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
            Pas d'inquiétude : votre commande <strong>${orderRef}</strong> reste valide. Nous lui cherchons un nouveau transporteur dans les plus brefs délais.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#16a34a;border-radius:8px;">
            <a href="https://zandofy.com/orders/${orderId}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
              Suivre ma commande
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#6b7280;">Zandofy — Marketplace sino-africaine</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}