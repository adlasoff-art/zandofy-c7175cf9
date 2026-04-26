/**
 * notify-operator-new-order — Lot 11B Phase B4
 *
 * Notifie l'owner d'un opérateur de livraison qu'une commande lui a été
 * attribuée au checkout (`orders.delivery_operator_id`).
 *
 * Auth : utilisateur connecté (le client qui vient de passer commande).
 * Vérifie : la commande existe, lui appartient, contient un delivery_operator_id.
 * Insère : une notification in-app pour `delivery_operators.owner_user_id`.
 * Envoie : un email transactionnel SMTP Hostinger à l'owner (best-effort).
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

    // Envoi email best-effort à l'owner
    let emailSent = false;
    try {
      const { data: ownerProfile } = await svc
        .from("profiles")
        .select("email, first_name")
        .eq("id", op.owner_user_id)
        .maybeSingle();

      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASS");
      const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");

      if (
        ownerProfile?.email &&
        smtpHost &&
        smtpUser &&
        smtpPass &&
        fromEmail
      ) {
        const transport = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        const greeting = ownerProfile.first_name
          ? `Bonjour ${ownerProfile.first_name},`
          : "Bonjour,";
        const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#16a34a;padding:24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">🚚 Nouvelle commande à livrer</h1>
        </td></tr>
        <tr><td style="padding:32px 28px;color:#1f2937;">
          <p style="font-size:16px;margin:0 0 16px;">${greeting}</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
            Une nouvelle commande vient de vous être attribuée sur <strong>Zandofy</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:16px 0;">
            <tr><td style="padding:16px;">
              <p style="margin:0 0 8px;font-size:14px;"><strong>Référence :</strong> ${orderRef}</p>
              <p style="margin:0 0 8px;font-size:14px;"><strong>Ville :</strong> ${order.shipping_city || "—"}</p>
              <p style="margin:0;font-size:14px;"><strong>Frais last-mile :</strong> $${fee}</p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#4b5563;margin:0 0 24px;">
            Connectez-vous à votre tableau de bord opérateur pour assigner un livreur.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#16a34a;border-radius:8px;">
            <a href="https://zandofy.com/operator/orders" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
              Voir la commande
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#6b7280;">Zandofy — Plateforme multi-opérateurs de livraison</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

        await transport.sendMail({
          from: fromEmail,
          to: ownerProfile.email,
          subject: `🚚 Nouvelle commande ${orderRef} à livrer`,
          html,
        });
        emailSent = true;
      }
    } catch (emailErr) {
      console.error("[notify-operator-new-order] email failed:", emailErr);
      // Non bloquant : la notif in-app a déjà été créée
    }

    return json({ ok: true, emailSent });
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