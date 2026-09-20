/**
 * PawaPay webhook receiver — stub until live provider wiring.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }
  // Acknowledge to avoid provider retries once live; no-op until secrets configured.
  return new Response(JSON.stringify({ received: true, configured: false }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
