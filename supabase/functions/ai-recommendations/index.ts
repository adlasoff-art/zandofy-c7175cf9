// Deploy trigger: 2026-04-08
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { userId } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const sb = createClient(supabaseUrl, serviceKey);

    // Get user's purchase history
    const { data: orderItems } = await sb
      .from("order_items")
      .select("product_id, product_name")
      .eq("order_id", userId ? undefined : "")
      .limit(20);

    // Get user's recent orders
    const { data: orders } = userId ? await sb
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5) : { data: [] };

    let purchasedProductIds: string[] = [];
    if (orders?.length) {
      const orderIds = orders.map((o: any) => o.id);
      const { data: items } = await sb
        .from("order_items")
        .select("product_id")
        .in("order_id", orderIds);
      purchasedProductIds = (items || []).map((i: any) => i.product_id).filter(Boolean);
    }

    // Get user's wishlist
    const { data: wishlist } = userId ? await sb
      .from("wishlists")
      .select("product_id")
      .eq("user_id", userId)
      .limit(10) : { data: [] };

    const wishlistIds = (wishlist || []).map((w: any) => w.product_id);

    // Get categories from purchased/wishlisted products
    const interestIds = [...new Set([...purchasedProductIds, ...wishlistIds])];

    let categoryIds: string[] = [];
    if (interestIds.length > 0) {
      const { data: prods } = await sb
        .from("products")
        .select("category_id")
        .in("id", interestIds.slice(0, 20));
      categoryIds = [...new Set((prods || []).map((p: any) => p.category_id).filter(Boolean))];
    }

    // Recommend products from same categories, excluding already purchased
    let query = sb
      .from("products")
      .select("id, name, price, image, slug, rating")
      .eq("status", "approved")
      .order("rating", { ascending: false })
      .limit(16);

    if (categoryIds.length > 0) {
      query = query.in("category_id", categoryIds);
    }

    const { data: recommended } = await query;

    // Filter out already purchased
    const filtered = (recommended || []).filter(
      (p: any) => !purchasedProductIds.includes(p.id)
    ).slice(0, 8);

    // If we have Lovable AI and enough context, use AI to rank
    if (lovableKey && interestIds.length >= 3 && filtered.length > 4) {
      try {
        const productList = filtered.map((p: any) => `${p.id}|${p.name}|$${p.price}|★${p.rating || 0}`).join("\n");
        const purchasedNames = purchasedProductIds.length > 0
          ? (await sb.from("products").select("name").in("id", purchasedProductIds.slice(0, 5))).data?.map((p: any) => p.name).join(", ") || ""
          : "";

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: "You are a product recommendation engine. Given a user's purchase history and a list of candidate products, return the product IDs in order of relevance (most relevant first). Return ONLY a JSON array of product IDs, nothing else.",
              },
              {
                role: "user",
                content: `User previously bought: ${purchasedNames}\n\nCandidate products:\n${productList}\n\nReturn the IDs ranked by relevance as a JSON array.`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          const match = content.match(/\[[\s\S]*?\]/);
          if (match) {
            const rankedIds: string[] = JSON.parse(match[0]);
            const ranked = rankedIds
              .map((id) => filtered.find((p: any) => p.id === id))
              .filter(Boolean)
              .slice(0, 8);
            if (ranked.length >= 4) {
              return new Response(JSON.stringify({ products: ranked }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }
      } catch {
        // AI ranking failed, fall through to default
      }
    }

    return new Response(JSON.stringify({ products: filtered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
