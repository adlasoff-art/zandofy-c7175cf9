// Edge Function: platform-bootstrap
// Returns all critical platform_settings in a single CDN-cached response.
// Replaces 8+ sequential client requests on first paint.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BOOTSTRAP_KEYS = [
  "branding",
  "seo_config",
  "theme_colors",
  "header_theme",
  "footer_theme",
  "topbar_config",
  "footer_config",
  "free_shipping_threshold",
  "geo_blocked_countries",
  "active_countries",
  "ui_config",
  "visual_search_enabled",
  "maintenance_mode",
  "cookie_settings",
  "cms_texts",
  "app_promo",
  "referral_settings",
  "seo_enabled",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", BOOTSTRAP_KEYS);

    if (error) throw error;

    const settings: Record<string, unknown> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value;
    }

    return new Response(JSON.stringify({ settings }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // 5 min CDN cache, 1h stale-while-revalidate
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
        "CDN-Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("[platform-bootstrap]", e);
    return new Response(
      JSON.stringify({ settings: {}, error: String(e) }),
      {
        status: 200, // fail open
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
