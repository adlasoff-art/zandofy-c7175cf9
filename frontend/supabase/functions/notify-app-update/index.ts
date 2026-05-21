import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPushSafe } from "../_shared/web-push.ts";

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = [
    "https://studio.zandofy.com",
    "https://zandofy.com",
    "https://www.zandofy.com",
  ];
  const isAllowed =
    allowed.includes(origin) ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com") ||
    origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/**
 * Broadcast a "new app version available" web-push to ALL active subscribers.
 * Admin-only. Triggered manually by the platform admin (or by Lovable after a
 * minor/major version bump).
 *
 * Body: { version: string, title?: string, body?: string, url?: string }
 */
Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ─── Authn + admin check ───
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ─── Body ───
    const body = await req.json().catch(() => ({}));
    const version = String(body?.version || "").trim();
    if (!version) {
      return new Response(JSON.stringify({ error: "version required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const title = body?.title || `Nouvelle version Zandofy v${version}`;
    const message = body?.body || "Touchez pour mettre à jour l'application.";
    const url = body?.url || "/?source=update-push";

    // ─── Fetch all distinct user_ids with active push subscriptions ───
    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("user_id");
    if (subsErr) throw subsErr;

    const userIds = Array.from(
      new Set((subs || []).map((s: any) => s.user_id).filter(Boolean)),
    );

    if (!userIds.length) {
      return new Response(
        JSON.stringify({ ok: true, attempted: 0, sent: 0, message: "no subscribers" }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const result = await sendWebPushSafe(admin, {
      userIds,
      payload: {
        title,
        body: message,
        url,
        tag: `app-update-${version}`,
        requireInteraction: true,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, version, recipients: userIds.length, ...result }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[notify-app-update] error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});