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
import nodemailer from "npm:nodemailer@6.9.16";

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

      // 4) email client (best-effort)
      await sendClientExpiredEmail(svc, order.user_id, ref, order.id);

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

async function sendClientExpiredEmail(
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
    const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#f59e0b;padding:24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">⏳ Recherche d'un transporteur</h1>
        </td></tr>
        <tr><td style="padding:32px 28px;color:#1f2937;">
          <p style="font-size:16px;margin:0 0 16px;">${greeting}</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
            Le transporteur attribué à votre commande <strong>${orderRef}</strong> n'a pas confirmé la prise en charge dans le délai imparti.
          </p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
            Nous lui cherchons un remplaçant — votre commande reste valide.
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
    await transport.sendMail({
      from: fromEmail,
      to: profile.email,
      subject: `⏳ Recherche d'un transporteur pour votre commande ${orderRef}`,
      html,
    });
  } catch (err) {
    console.error("[expire-operator-assignments] client email failed:", err);
  }
}