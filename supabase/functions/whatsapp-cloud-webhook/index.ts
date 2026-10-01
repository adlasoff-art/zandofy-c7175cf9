/**
 * WhatsApp Cloud webhook — verify challenge + log delivery statuses.
 * Secrets: WHATSAPP_CLOUD_VERIFY_TOKEN, WHATSAPP_CLOUD_APP_SECRET (optional HMAC)
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Meta webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("WHATSAPP_CLOUD_VERIFY_TOKEN") || "";
    if (mode === "subscribe" && token && expected && token === expected) {
      return new Response(challenge || "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    // Optional: verify X-Hub-Signature-256 with WHATSAPP_CLOUD_APP_SECRET
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    // Persist raw status events for ops (best-effort)
    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        const statuses = value?.statuses || [];
        for (const st of statuses) {
          await svc.from("outreach_send_log").insert({
            user_id: null,
            template_id: null,
            channel: "whatsapp_cloud",
            status: st.status === "failed" ? "failed" : st.status === "read" || st.status === "delivered" ? "opened" : "sent",
            actor_admin_id: null,
            meta: {
              source: "webhook",
              wamid: st.id,
              recipient_id: st.recipient_id,
              wa_status: st.status,
              timestamp: st.timestamp,
            },
          }).then(() => {}).catch((e: Error) => console.warn("[wa-webhook] log", e.message));
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-cloud-webhook]", err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
