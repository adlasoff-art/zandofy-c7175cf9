/**
 * PawaPay webhook receiver — reject until HMAC secret is configured.
 * Not a browser endpoint (no permissive CORS).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const secret = Deno.env.get("PAWAPAY_WEBHOOK_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sig = req.headers.get("x-pawapay-signature") || req.headers.get("authorization");
  if (!sig) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Live signature verification lands with provider wiring.
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
