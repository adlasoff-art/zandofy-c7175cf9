import { createClient } from "npm:@supabase/supabase-js@2";
import {
  embedImageFromUrl,
  embeddingToPgVector,
  embeddingModelForStorage,
} from "../_shared/image-embedding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function isAuthorized(req: Request, supabaseAdmin: ReturnType<typeof createClient>): Promise<boolean> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader === `Bearer ${serviceKey}`) return true;

  if (!authHeader.startsWith("Bearer ")) return false;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
  return (roles || []).some((r: { role: string }) => r.role === "admin" || r.role === "manager");
}

async function resolvePrimaryImageId(
  supabaseAdmin: ReturnType<typeof createClient>,
  productId?: string,
  productImageId?: string,
): Promise<string | null> {
  if (productImageId) return productImageId;
  if (!productId) return null;
  const { data } = await supabaseAdmin
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let resolvedImageId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    if (!(await isAuthorized(req, supabaseAdmin))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const imageId = await resolvePrimaryImageId(
      supabaseAdmin,
      body.product_id as string | undefined,
      body.product_image_id as string | undefined,
    );
    resolvedImageId = imageId;

    if (!imageId) {
      return new Response(JSON.stringify({ error: "product_image_id or product_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("product_images")
      .select("id, product_id, image_url, embedding_status")
      .eq("id", imageId)
      .single();

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: "Image not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.embedding_status === "skipped") {
      return new Response(JSON.stringify({ skipped: true, product_image_id: imageId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vector = await embedImageFromUrl(row.image_url);
    const pgVector = embeddingToPgVector(vector);

    const { error: updateErr } = await supabaseAdmin
      .from("product_images")
      .update({
        embedding: pgVector,
        embedding_model: embeddingModelForStorage(),
        embedded_at: new Date().toISOString(),
        embedding_status: "ready",
      })
      .eq("id", imageId);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ ok: true, product_image_id: imageId, product_id: row.product_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("index-product-image error:", message);

    if (resolvedImageId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabaseAdmin
          .from("product_images")
          .update({ embedding_status: "failed" })
          .eq("id", resolvedImageId);
      } catch {
        /* ignore */
      }
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
