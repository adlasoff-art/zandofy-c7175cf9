// Edge Function: platform-bootstrap (prod)
// Returns all critical platform_settings in a single CDN-cached response.
// Replaces 8+ sequential client requests on first paint.

import { createClient } from "npm:@supabase/supabase-js@2";

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
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[1],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

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
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight — ALWAYS first, never blocked by auth
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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
      },
    );
  }
});
