/**
 * track-shipment-17track
 *
 * Proxies tracking requests to 17track REST API v2.2 and returns a normalized
 * payload usable by the frontend. Falls back gracefully when the API key is
 * not configured (returns 503 with `configured: false`) so the UI can still
 * fall back to internal Zandofy tracking.
 *
 * Body: { tracking_number: string, carrier?: number | null }
 * Returns: { configured: boolean, raw?: any, error?: string }
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SEVENTEEN_TRACK_BASE = "https://api.17track.net/track/v2.2";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("SEVENTEEN_TRACK_API_KEY");
  if (!apiKey) {
    // Graceful: tell the client the provider is not configured.
    return jsonResponse(
      { configured: false, error: "17track API key not configured on the server" },
      503,
    );
  }

  let body: { tracking_number?: string; carrier?: number | null };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ configured: true, error: "Invalid JSON body" }, 400);
  }

  const trackingNumber = (body.tracking_number ?? "").trim();
  if (!trackingNumber || trackingNumber.length > 64) {
    return jsonResponse({ configured: true, error: "tracking_number is required (1-64 chars)" }, 400);
  }

  const payload: Array<{ number: string; carrier?: number }> = [{ number: trackingNumber }];
  if (typeof body.carrier === "number" && body.carrier > 0) {
    payload[0].carrier = body.carrier;
  }

  // Step 1: register the tracking number (idempotent on 17track side)
  try {
    await fetch(`${SEVENTEEN_TRACK_BASE}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Registration errors are not fatal — gettrackinfo may still work for known numbers.
    console.warn("[17track] register warning:", e);
  }

  // Step 2: fetch tracking info
  try {
    const res = await fetch(`${SEVENTEEN_TRACK_BASE}/gettrackinfo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return jsonResponse(
        { configured: true, error: `17track HTTP ${res.status}: ${text.slice(0, 200)}` },
        502,
      );
    }

    const data = await res.json();
    // 17track wraps results in { code, data: { accepted: [...], rejected: [...] } }
    const accepted = data?.data?.accepted?.[0] ?? null;
    if (!accepted) {
      return jsonResponse({ configured: true, raw: data, error: "Tracking number not found" }, 404);
    }

    return jsonResponse({ configured: true, raw: accepted });
  } catch (e) {
    console.error("[17track] fetch error:", e);
    return jsonResponse({ configured: true, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});