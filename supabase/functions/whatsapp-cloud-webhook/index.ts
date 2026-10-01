/**
 * WhatsApp Cloud webhook — verify challenge + log delivery statuses.
 * Secrets: WHATSAPP_CLOUD_VERIFY_TOKEN, WHATSAPP_CLOUD_APP_SECRET (HMAC when set)
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

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
    const rawBody = await req.text();
    const appSecret = Deno.env.get("WHATSAPP_CLOUD_APP_SECRET") || "";

    // When App Secret is configured, require valid X-Hub-Signature-256
    if (appSecret) {
      const header = req.headers.get("X-Hub-Signature-256") || "";
      const expectedHex = await hmacSha256Hex(appSecret, rawBody);
      const provided = header.startsWith("sha256=") ? header.slice(7) : "";
      if (!provided || !timingSafeEqual(provided, expectedHex)) {
        return new Response(JSON.stringify({ ok: false, error: "invalid_signature" }), {
          status: 401,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody || "{}");
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    const entries = (payload as { entry?: unknown[] })?.entry || [];
    for (const entry of entries as { changes?: unknown[] }[]) {
      const changes = entry?.changes || [];
      for (const change of changes as { value?: { statuses?: unknown[] } }[]) {
        const statuses = change?.value?.statuses || [];
        for (const st of statuses as {
          id?: string;
          status?: string;
          recipient_id?: string;
          timestamp?: string;
        }[]) {
          const waStatus = st.status || "";
          const mapped =
            waStatus === "failed"
              ? "failed"
              : waStatus === "read" || waStatus === "delivered"
                ? "opened"
                : "sent";
          await svc.from("outreach_send_log").insert({
            user_id: null,
            template_id: null,
            channel: "whatsapp_cloud",
            status: mapped,
            actor_admin_id: null,
            meta: {
              source: "webhook",
              wamid: st.id,
              recipient_id: st.recipient_id,
              wa_status: waStatus,
              timestamp: st.timestamp,
            },
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-cloud-webhook]", err);
    // Always 200 to Meta after auth to avoid retry storms on our bugs
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
