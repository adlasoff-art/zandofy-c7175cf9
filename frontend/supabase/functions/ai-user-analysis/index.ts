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
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Verify admin
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminId = authUser.id;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId);

    const isStaff = adminRoles?.some((r: any) => ["admin", "manager"].includes(r.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Staff role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { targetUserId, analysisType } = await req.json();

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "targetUserId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Gather user data for analysis
    const [profileRes, ordersRes, activityRes, ratingsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", targetUserId).single(),
      supabaseAdmin.from("orders").select("id, status, total, subtotal, created_at, store_id").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("user_activity_logs").select("action, metadata, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("customer_ratings").select("rating, comment, created_at").eq("customer_id", targetUserId).order("created_at", { ascending: false }).limit(20),
    ]);

    const profile = profileRes.data;
    const orders = ordersRes.data || [];
    const activities = activityRes.data || [];
    const ratings = ratingsRes.data || [];

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If no AI key, return raw stats only
    if (!lovableApiKey) {
      const totalOrders = orders.length;
      const cancelledOrders = orders.filter((o: any) => o.status === "cancelled").length;
      const totalSpent = orders.filter((o: any) => o.status === "delivered").reduce((s: number, o: any) => s + (o.total || 0), 0);
      const avgRating = ratings.length > 0 ? ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length : null;

      return new Response(JSON.stringify({
        analysis_type: "stats_only",
        stats: {
          total_orders: totalOrders,
          cancelled_orders: cancelledOrders,
          cancellation_rate: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
          total_spent: Math.round(totalSpent * 100) / 100,
          avg_basket: totalOrders > 0 ? Math.round((totalSpent / totalOrders) * 100) / 100 : 0,
          avg_vendor_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
          activity_count: activities.length,
          login_count: activities.filter((a: any) => a.action === "login").length,
          last_activity: activities[0]?.created_at || null,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // AI-powered analysis
    const totalOrders = orders.length;
    const cancelledOrders = orders.filter((o: any) => o.status === "cancelled").length;
    const deliveredOrders = orders.filter((o: any) => o.status === "delivered");
    const totalSpent = deliveredOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length : null;

    const userSummary = `
Profil utilisateur:
- Nom: ${profile.first_name || ""} ${profile.last_name || ""}
- Email: ${profile.email}
- Inscrit: ${profile.created_at}
- Dernière connexion: ${profile.last_login_at || "N/A"}
- Nb connexions: ${profile.login_count || 0}
- Tier client: ${profile.customer_tier || "bronze"}
- Nationalité: ${profile.nationality || "N/A"}
- Banni: ${profile.is_banned ? "Oui" : "Non"}

Commandes (${totalOrders} total):
- Livrées: ${deliveredOrders.length}
- Annulées: ${cancelledOrders} (taux: ${totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0}%)
- Montant total: $${totalSpent.toFixed(2)}
- Panier moyen: $${totalOrders > 0 ? (totalSpent / totalOrders).toFixed(2) : "0"}

Notation vendeur→client: ${avgRating ? avgRating.toFixed(1) + "/5" : "Aucune"}

Activités récentes (${activities.length} logs):
${activities.slice(0, 20).map((a: any) => `- ${a.action} @ ${a.created_at}`).join("\n")}
`.trim();

    const systemPrompt = analysisType === "risk"
      ? "Tu es un analyste de risques pour une marketplace e-commerce. Analyse ce profil utilisateur et évalue le score de risque (0-100). Identifie les comportements suspects (taux d'annulation élevé, patterns inhabituels, etc.). Réponds en français avec un JSON structuré."
      : "Tu es un analyste CRM pour une marketplace e-commerce. Analyse ce profil utilisateur pour la segmentation client. Identifie les habitudes d'achat, la fidélité, les préférences et recommande des actions marketing. Réponds en français avec un JSON structuré.";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userSummary },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "user_analysis",
              description: "Structured user analysis output",
              parameters: {
                type: "object",
                properties: {
                  risk_score: { type: "number", description: "Score de risque 0-100 (uniquement pour analyse risk)" },
                  segment: { type: "string", description: "Segment client: vip, fidele, occasionnel, dormant, a_risque" },
                  summary: { type: "string", description: "Résumé en 2-3 phrases" },
                  flags: { type: "array", items: { type: "string" }, description: "Signalements ou points d'attention" },
                  recommendations: { type: "array", items: { type: "string" }, description: "Recommandations d'actions" },
                  purchase_pattern: { type: "string", description: "Description du pattern d'achat" },
                },
                required: ["segment", "summary", "flags", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "user_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        analysis_type: "stats_only",
        stats: {
          total_orders: totalOrders,
          cancelled_orders: cancelledOrders,
          cancellation_rate: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
          total_spent: Math.round(totalSpent * 100) / 100,
          avg_basket: totalOrders > 0 ? Math.round((totalSpent / totalOrders) * 100) / 100 : 0,
          avg_vendor_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    let analysis = {};
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analysis = JSON.parse(toolCall.function.arguments);
      }
    } catch {
      analysis = { summary: "Analyse indisponible", flags: [], recommendations: [] };
    }

    return new Response(JSON.stringify({
      analysis_type: analysisType || "segmentation",
      analysis,
      stats: {
        total_orders: totalOrders,
        cancelled_orders: cancelledOrders,
        cancellation_rate: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
        total_spent: Math.round(totalSpent * 100) / 100,
        avg_basket: totalOrders > 0 ? Math.round((totalSpent / totalOrders) * 100) / 100 : 0,
        avg_vendor_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        activity_count: activities.length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-user-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
