import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Daily cron: accrue hub storage charges past free_until
 * (vendor 14d inventory / buyer 21d order).
 * Auth: service role only — require Authorization bearer = service role OR cron secret.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get("HUB_ACCRUE_CRON_SECRET") || Deno.env.get("CRON_SECRET");
    const auth = req.headers.get("Authorization") || "";
    const headerSecret = req.headers.get("x-cron-secret") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const authorized =
      (cronSecret && (headerSecret === cronSecret || token === cronSecret)) ||
      token === serviceKey;

    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const asOf = (body as { as_of?: string })?.as_of || undefined;

    const { data, error } = await supabase.rpc("accrue_hub_storage_charges", {
      p_as_of: asOf || new Date().toISOString().slice(0, 10),
    });

    if (error) {
      console.error("[accrue-hub-storage]", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data ?? { ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[accrue-hub-storage]", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
