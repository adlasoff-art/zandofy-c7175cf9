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

const SYSTEM_PROMPT =
  "You are a product identification AI for an e-commerce platform. Analyze the image and extract relevant search keywords to find matching products. Return keywords in both French and English.";

const USER_PROMPT =
  "Analyze this product image and extract 5-8 e-commerce search keywords that would help find this product or similar products in a marketplace. Include product type, color, material, style, and category.";

const EXTRACT_KEYWORDS_TOOL = {
  type: "function",
  function: {
    name: "extract_keywords",
    description: "Extract structured search keywords from the product image analysis.",
    parameters: {
      type: "object",
      properties: {
        keywords_fr: {
          type: "array",
          items: { type: "string" },
          description: "5-8 search keywords in French",
        },
        keywords_en: {
          type: "array",
          items: { type: "string" },
          description: "5-8 search keywords in English",
        },
        product_type: {
          type: "string",
          description: "Main product type/category in French",
        },
        color: {
          type: "string",
          description: "Primary color in French",
        },
      },
      required: ["keywords_fr", "keywords_en", "product_type"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { image_base64 } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawBase64 = image_base64 as string;
    let mimeType = "image/jpeg";

    if (rawBase64.startsWith("data:")) {
      const match = rawBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/s);
      if (match) {
        mimeType = match[1];
        rawBase64 = match[2];
      } else {
        rawBase64 = rawBase64.replace(/^data:[^;]+;base64,/, "");
      }
    }

    rawBase64 = rawBase64.replace(/\s/g, "");
    const imageUrl = `data:${mimeType};base64,${rawBase64}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          },
        ],
        tools: [EXTRACT_KEYWORDS_TOOL],
        tool_choice: { type: "function", function: { name: "extract_keywords" } },
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", openaiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await openaiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({
          keywords: { keywords_fr: [], keywords_en: [], product_type: "unknown" },
          products: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({
          keywords: { keywords_fr: [], keywords_en: [], product_type: "unknown" },
          products: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keywords = {
      keywords_fr: (extracted.keywords_fr as string[]) || [],
      keywords_en: (extracted.keywords_en as string[]) || [],
      product_type: (extracted.product_type as string) || "unknown",
      color: (extracted.color as string) || null,
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const allKeywords = [
      ...keywords.keywords_fr,
      ...keywords.keywords_en,
      keywords.product_type,
      ...(keywords.color ? [keywords.color] : []),
    ].filter(Boolean);

    const orFilter = allKeywords
      .flatMap((kw) => [
        `name.ilike.%${kw}%`,
        `name_fr.ilike.%${kw}%`,
        `description.ilike.%${kw}%`,
      ])
      .join(",");

    const { data: products, error: dbError } = await supabase
      .from("products")
      .select("id, name, name_fr, price, currency, description, rating, review_count, store_id")
      .eq("publish_status", "published")
      .or(orFilter)
      .limit(20);

    if (dbError) console.error("DB error:", dbError);

    const productList = products || [];

    let productImages: Record<string, string> = {};
    if (productList.length > 0) {
      const productIds = productList.map((p) => p.id);
      const { data: images } = await supabase
        .from("product_images")
        .select("product_id, image_url, position")
        .in("product_id", productIds)
        .order("position", { ascending: true });

      if (images) {
        for (const img of images) {
          if (!productImages[img.product_id]) {
            productImages[img.product_id] = img.image_url;
          }
        }
      }
    }

    const results = productList.map((p) => ({
      id: p.id,
      name: p.name,
      name_fr: p.name_fr,
      price: Number(p.price) || 0,
      currency: p.currency || "USD",
      description: p.description,
      rating: p.rating != null ? Number(p.rating) : null,
      review_count: p.review_count,
      store_id: p.store_id,
      image: productImages[p.id] || "/placeholder.svg",
    }));

    return new Response(JSON.stringify({ keywords, products: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("visual-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
