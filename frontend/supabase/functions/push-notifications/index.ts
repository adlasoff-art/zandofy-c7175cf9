import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

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
  };
}

// Simple base64url encode/decode helpers
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(pad);
  const raw = atob(padded);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Generate VAPID keys using Web Crypto
async function generateVapidKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    publicKey: uint8ArrayToBase64Url(new Uint8Array(publicKeyRaw)),
    privateKey: privateKeyJwk.d!,
  };
}

// Create JWT for VAPID
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyB64: string
) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject, iat: now };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import private key
  const d = privateKeyB64;
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d,
    // We need x and y — derive from stored public key
    x: "",
    y: "",
  };

  // We'll use a simpler approach: store the full JWK
  // For now, skip VAPID auth and use a simpler push approach
  return unsigned;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Rate limiting: 30 requests/min by IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { data: rlAllowed } = await supabase.rpc("check_rate_limit", {
    p_identifier: clientIp,
    p_endpoint: "push-notifications",
    p_max_requests: 30,
    p_window_seconds: 60,
  });
  if (rlAllowed === false) {
    return new Response(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // GET vapid public key
    if (action === "vapid-public-key") {
      // Check if VAPID keys exist in a simple KV approach
      // We'll store them as secrets — for now return a generated one
      let publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      if (!publicKey) {
        // Generate and return — admin should store these as secrets
        const keys = await generateVapidKeys();
        return new Response(
          JSON.stringify({
            publicKey: keys.publicKey,
            needsSetup: true,
            message: "VAPID keys generated. Store VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY as secrets.",
            generatedPublicKey: keys.publicKey,
            generatedPrivateKey: keys.privateKey,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ publicKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST subscribe
    if (action === "subscribe" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { subscription } = await req.json();
      const { endpoint, keys } = subscription;

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST send-push (admin/internal use)
    if (action === "send-push" && req.method === "POST") {
      const { title, body, url: link, userIds } = await req.json();

      // Get subscriptions
      let query = supabase.from("push_subscriptions").select("*");
      if (userIds && userIds.length > 0) {
        query = query.in("user_id", userIds);
      }
      const { data: subs } = await query;

      // Also create in-app notifications
      if (userIds && userIds.length > 0) {
        const notifications = userIds.map((uid: string) => ({
          user_id: uid,
          type: "promo",
          title,
          message: body,
          link: link || null,
        }));
        await supabase.from("notifications").insert(notifications);
      }

      // For Web Push, we need VAPID keys configured
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(
          JSON.stringify({
            ok: true,
            pushSent: 0,
            inAppSent: userIds?.length || 0,
            message: "In-app notifications sent. Web Push requires VAPID keys to be configured.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let pushSent = 0;
      try {
        const vapidKeys = await webpush.importVapidKeys(
          { publicKey: vapidPublicKey, privateKey: vapidPrivateKey },
          { extractable: false }
        );
        const appServer = await webpush.ApplicationServer.new({
          contactInformation: "mailto:noreply@zandofy.com",
          vapidKeys,
        });
        const payload = JSON.stringify({ title, body, url: link || undefined });
        const subscriptionList = Array.isArray(subs) ? subs : [];
        for (const row of subscriptionList) {
          if (!row?.endpoint || !row?.p256dh || !row?.auth) continue;
          try {
            const subscriber = appServer.subscribe({
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            });
            await subscriber.pushTextMessage(payload, {});
            pushSent++;
          } catch (e) {
            console.warn("Push send failed for subscription:", row.endpoint?.slice(0, 50), e);
          }
        }
      } catch (err) {
        console.error("Web Push setup or send error:", err);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          subscriptions: subs?.length || 0,
          pushSent,
          inAppSent: userIds?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
