/**
 * Lot 4L — Notify customer of handoff status change
 *
 * Triggered (via pg_net) by the DB trigger on forwarder_handoffs UPDATE.
 * Sends a transactional email to the order owner. The in-app notification is
 * already created inside the SQL trigger.
 *
 * Auth: service-role only (called from the database). No JWT is required from
 * end users; instead the function checks a shared secret header.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";
import { sendWebPushSafe } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-internal-token",
};

const STATUS_LABEL: Record<string, { title: string; intro: string }> = {
  acknowledged: {
    title: "Votre commande a été prise en charge par le transitaire",
    intro: "Le transitaire a réceptionné votre commande et la prépare pour l'expédition internationale.",
  },
  in_transit: {
    title: "Votre commande est en transit international",
    intro: "Votre commande est désormais en route vers la destination. Elle passera prochainement la douane.",
  },
  delivered: {
    title: "Votre commande est arrivée à destination",
    intro: "Votre commande est arrivée au hub local. Elle sera bientôt mise en livraison à votre adresse.",
  },
  cancelled: {
    title: "Expédition internationale annulée",
    intro: "Le transitaire a annulé la prise en charge de votre commande. Notre équipe va vous recontacter.",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const internalToken = req.headers.get("x-internal-token");
    const expected = Deno.env.get("INTERNAL_TRIGGER_TOKEN") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // fallback to service role
    if (!internalToken || internalToken !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { handoffId } = await req.json();
    if (!handoffId) {
      return new Response(JSON.stringify({ error: "handoffId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: handoff, error: hErr } = await svc
      .from("forwarder_handoffs")
      .select("id, order_id, status, forwarder_id")
      .eq("id", handoffId)
      .maybeSingle();
    if (hErr || !handoff) {
      return new Response(JSON.stringify({ error: "Handoff not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = STATUS_LABEL[handoff.status as string];
    if (!meta) {
      return new Response(JSON.stringify({ skipped: "no_email_for_status" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order } = await svc
      .from("orders")
      .select("id, order_ref, user_id, shipping_email, shipping_first_name, shipping_country, shipping_city")
      .eq("id", handoff.order_id)
      .maybeSingle();
    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let recipientEmail: string | null = order.shipping_email ?? null;
    if (!recipientEmail && order.user_id) {
      const { data: profile } = await svc.from("profiles").select("email").eq("id", order.user_id).maybeSingle();
      recipientEmail = profile?.email ?? null;
    }
    if (!recipientEmail) {
      return new Response(JSON.stringify({ skipped: "no_recipient_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: forwarder } = await svc
      .from("forwarders")
      .select("name")
      .eq("id", handoff.forwarder_id)
      .maybeSingle();

    const orderRef = order.order_ref ?? order.id;
    const subject = `Zandofy — ${meta.title} (commande ${orderRef})`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;color:#111;">
        <h2 style="margin:0 0 16px;color:#0f172a;">${meta.title}</h2>
        <p>Bonjour ${order.shipping_first_name ?? ""},</p>
        <p>${meta.intro}</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:6px 0;color:#666;">Référence commande</td><td style="padding:6px 0;"><strong>${orderRef}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Transitaire</td><td style="padding:6px 0;">${forwarder?.name ?? "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Destination</td><td style="padding:6px 0;">${order.shipping_city ?? ""} ${order.shipping_country ?? ""}</td></tr>
        </table>
        <p><a href="https://zandofy.com/dashboard" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Suivre ma commande</a></p>
        <p style="color:#888;font-size:12px;margin-top:32px;">Cet email vous a été envoyé automatiquement par Zandofy.</p>
      </div>
    `;

    await sendEmail({ to: recipientEmail, subject, html });

    if (order.user_id) {
      await sendWebPushSafe(svc, {
        userIds: [order.user_id],
        payload: {
          title: meta.title,
          body: `Commande ${orderRef} — ${meta.intro}`.slice(0, 200),
          url: `/orders/${order.id}`,
          tag: `handoff-${order.id}-${handoff.status ?? ""}`,
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[notify-handoff-status-customer] error", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});