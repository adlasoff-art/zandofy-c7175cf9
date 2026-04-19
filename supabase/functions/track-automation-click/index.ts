const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const to = url.searchParams.get("to") || "/";
    const workflowId = url.searchParams.get("w");
    const userId = url.searchParams.get("u");
    const anonId = url.searchParams.get("a");
    const channel = url.searchParams.get("c") || "email"; // email | popup

    if (workflowId) {
      const { createClient } = await import("npm:@supabase/supabase-js@2");
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const eventType = channel === "popup" ? "clicked_popup_cta" : "clicked_email_link";

      await supabaseAdmin.from("automation_events").insert({
        workflow_id: workflowId,
        user_id: userId || null,
        anon_id: anonId || null,
        event_type: eventType,
        metadata: { destination: to },
      });
    }

    // Validate destination — allow only http(s) or relative paths
    let destination = to;
    if (!destination.startsWith("http://") && !destination.startsWith("https://") && !destination.startsWith("/")) {
      destination = "/";
    }

    return new Response(null, {
      status: 302,
      headers: { ...CORS_HEADERS, Location: destination },
    });
  } catch (err) {
    console.error("track-automation-click error:", err);
    return new Response(null, {
      status: 302,
      headers: { ...CORS_HEADERS, Location: "/" },
    });
  }
});
