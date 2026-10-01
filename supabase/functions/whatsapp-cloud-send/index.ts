/**
 * WhatsApp Cloud API send — feature-flagged OFF by default.
 * Secrets: WHATSAPP_CLOUD_ENABLED, WHATSAPP_CLOUD_TOKEN, WHATSAPP_CLOUD_PHONE_NUMBER_ID
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { logOutreach } from "../_shared/outreach.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  try {
    const enabled = Deno.env.get("WHATSAPP_CLOUD_ENABLED") === "true";
    if (!enabled) {
      return json({ ok: false, reason: "disabled" }, 200);
    }

    const token = Deno.env.get("WHATSAPP_CLOUD_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID");
    if (!token || !phoneNumberId) {
      return json({ ok: false, reason: "missing_secrets" }, 503);
    }

    const body = await req.json();
    const userId = body.user_id as string | undefined;
    const templateId = body.template_id as string | undefined;
    const templateName = body.template_name as string | undefined;
    const language = (body.language as string) || "fr";
    const phoneRaw = String(body.phone_e164 || "").replace(/\D/g, "");
    const actorAdminId = (body.actor_admin_id as string) || null;
    const vars = (body.vars || {}) as Record<string, string>;

    if (!phoneRaw || phoneRaw.length < 8 || !templateName) {
      await logOutreach(svc, {
        user_id: userId || null,
        template_id: templateId || null,
        channel: "whatsapp_cloud",
        status: "failed",
        actor_admin_id: actorAdminId,
        meta: { reason: "invalid_phone_or_template" },
      });
      return json({ ok: false, reason: "invalid_phone_or_template" }, 400);
    }

    // Build simple body params from name / cta if template expects them
    const components: unknown[] = [];
    if (vars.name || vars.cta_url) {
      const parameters: { type: string; text: string }[] = [];
      if (vars.name) parameters.push({ type: "text", text: vars.name });
      if (vars.cta_url) parameters.push({ type: "text", text: vars.cta_url });
      if (parameters.length) {
        components.push({ type: "body", parameters });
      }
    }

    const graphRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneRaw,
          type: "template",
          template: {
            name: templateName,
            language: { code: language },
            ...(components.length ? { components } : {}),
          },
        }),
      },
    );

    const graphJson = await graphRes.json().catch(() => ({}));
    const ok = graphRes.ok;
    await logOutreach(svc, {
      user_id: userId || null,
      template_id: templateId || null,
      channel: "whatsapp_cloud",
      status: ok ? "sent" : "failed",
      actor_admin_id: actorAdminId,
      meta: {
        http_status: graphRes.status,
        wamid: graphJson?.messages?.[0]?.id,
        error: graphJson?.error || null,
      },
    });

    return json({ ok, graph: graphJson }, ok ? 200 : 502);
  } catch (err) {
    console.error("[whatsapp-cloud-send]", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
