import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  embedImageFromBase64,
  embeddingToPgVector,
} from "../_shared/image-embedding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
        keywords_fr: { type: "array", items: { type: "string" } },
        keywords_en: { type: "array", items: { type: "string" } },
        product_type: { type: "string" },
        color: { type: "string" },
      },
      required: ["keywords_fr", "keywords_en", "product_type"],
      additionalProperties: false,
    },
  },
};

type ProductRow = {
  id: string;
  name: string;
  name_fr: string;
  price: number;
  currency: string;
  description: string | null;
  rating: number | null;
  review_count: number | null;
  store_id: string | null;
};

async function loadProductResults(
  supabase: ReturnType<typeof createClient>,
  productIds: string[],
  similarities?: Record<string, number>,
) {
  if (!productIds.length) return [];

  const { data: products } = await supabase
    .from("products")
    .select("id, name, name_fr, price, currency, description, rating, review_count, store_id")
    .in("id", productIds)
    .eq("publish_status", "published");

  const list = (products || []) as ProductRow[];
  const { data: images } = await supabase
    .from("product_images")
    .select("product_id, image_url, position")
    .in("product_id", productIds)
    .order("position", { ascending: true });

  const productImages: Record<string, string> = {};
  for (const img of images || []) {
    if (!productImages[img.product_id]) productImages[img.product_id] = img.image_url;
  }

  const order = new Map(productIds.map((id, i) => [id, i]));
  return list
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
    .map((p) => ({
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
      similarity: similarities?.[p.id] ?? null,
      match_type: similarities?.[p.id] != null ? "vector" : "keyword",
    }));
}

async function vectorSearch(
  supabase: ReturnType<typeof createClient>,
  imageBase64: string,
) {
  try {
    const vector = await embedImageFromBase64(imageBase64);
    const pgVector = embeddingToPgVector(vector);

    for (const threshold of [0.88, 0.75]) {
      const { data: matches, error } = await supabase.rpc("match_products_by_image", {
        query_embedding: pgVector,
        match_threshold: threshold,
        match_count: 20,
      });
      if (error) {
        console.error("Vector RPC error:", error.message);
        return { products: [], search_mode: "vector_unavailable" as const };
      }
      if (matches?.length) {
        const simMap: Record<string, number> = {};
        const ids: string[] = [];
        for (const m of matches as { product_id: string; similarity: number }[]) {
          if (!simMap[m.product_id]) {
            simMap[m.product_id] = m.similarity;
            ids.push(m.product_id);
          }
        }
        const products = await loadProductResults(supabase, ids, simMap);
        return {
          products,
          search_mode: threshold >= 0.85 ? ("vector_exact" as const) : ("vector_similar" as const),
        };
      }
    }
    return { products: [], search_mode: "vector_empty" as const };
  } catch (e) {
    console.error("Vector search failed:", e);
    return { products: [], search_mode: "vector_error" as const };
  }
}

async function keywordFallback(
  supabase: ReturnType<typeof createClient>,
  imageBase64: string,
) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return {
      keywords: { keywords_fr: [] as string[], keywords_en: [] as string[], product_type: "unknown", color: null as string | null },
      products: [],
    };
  }

  let rawBase64 = imageBase64;
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

  const emptyKeywords = {
    keywords_fr: [] as string[],
    keywords_en: [] as string[],
    product_type: "unknown",
    color: null as string | null,
  };

  if (!openaiResponse.ok) {
    return { keywords: emptyKeywords, products: [] };
  }

  const aiData = await openaiResponse.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { keywords: emptyKeywords, products: [] };

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(toolCall.function.arguments);
  } catch {
    return { keywords: emptyKeywords, products: [] };
  }

  const keywords = {
    keywords_fr: (extracted.keywords_fr as string[]) || [],
    keywords_en: (extracted.keywords_en as string[]) || [],
    product_type: (extracted.product_type as string) || "unknown",
    color: (extracted.color as string) || null,
  };

  const allKeywords = [
    ...keywords.keywords_fr,
    ...keywords.keywords_en,
    keywords.product_type,
    ...(keywords.color ? [keywords.color] : []),
  ].filter(Boolean);

  if (!allKeywords.length) return { keywords, products: [] };

  const orFilter = allKeywords
    .flatMap((kw) => [
      `name.ilike.%${kw}%`,
      `name_fr.ilike.%${kw}%`,
      `description.ilike.%${kw}%`,
    ])
    .join(",");

  const { data: products } = await supabase
    .from("products")
    .select("id, name, name_fr, price, currency, description, rating, review_count, store_id")
    .neq("publish_status", "archived")
    .or(orFilter)
    .limit(20);

  const ids = (products || []).map((p: { id: string }) => p.id);
  const results = await loadProductResults(supabase, ids);
  return { keywords, products: results.map((p) => ({ ...p, match_type: "keyword" })) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64 } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const vectorResult = await vectorSearch(supabase, image_base64);
    if (vectorResult.products.length > 0) {
      return new Response(
        JSON.stringify({
          keywords: { keywords_fr: [], keywords_en: [], product_type: "visual", color: null },
          products: vectorResult.products,
          search_mode: vectorResult.search_mode,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fallback = await keywordFallback(supabase, image_base64);
    return new Response(
      JSON.stringify({
        keywords: fallback.keywords,
        products: fallback.products,
        search_mode: "keyword_fallback",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("visual-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
