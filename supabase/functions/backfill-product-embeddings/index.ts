import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireAdmin(req: Request, supabaseAdmin: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
  const ok = (roles || []).some((r: { role: string }) => r.role === "admin" || r.role === "manager");
  return ok ? user : null;
}

function pickPrimaryPending(rows: { id: string; product_id: string; position: number | null }[]) {
  const byProduct = new Map<string, { id: string; position: number }>();
  for (const row of rows) {
    const pos = row.position ?? 0;
    const existing = byProduct.get(row.product_id);
    if (!existing || pos < existing.position) {
      byProduct.set(row.product_id, { id: row.id, position: pos });
    }
  }
  return [...byProduct.values()].map((v) => v.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    if (!(await requireAdmin(req, supabaseAdmin))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body.batch_size) || 10, 1), 25);
    const delayMs = Math.min(Math.max(Number(body.delay_ms) || 300, 0), 2000);

    const { data: pendingRows, error: listErr } = await supabaseAdmin
      .from("product_images")
      .select("id, product_id, position, products!inner(publish_status)")
      .in("embedding_status", ["pending", "failed"])
      .eq("products.publish_status", "published")
      .limit(2000);

    if (listErr) throw listErr;

    const batchIds = pickPrimaryPending(pendingRows || []).slice(0, batchSize);
    const indexUrl = `${supabaseUrl}/functions/v1/index-product-image`;
    let processed = 0;
    const errors: string[] = [];

    for (let i = 0; i < batchIds.length; i++) {
      const imageId = batchIds[i];
      try {
        const res = await fetch(indexUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ product_image_id: imageId }),
        });
        if (!res.ok) {
          const txt = await res.text();
          errors.push(`${imageId}: ${txt.slice(0, 120)}`);
        } else {
          processed += 1;
        }
      } catch (err) {
        errors.push(`${imageId}: ${err instanceof Error ? err.message : "error"}`);
      }
      if (delayMs > 0 && i < batchIds.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    const { data: remainingRows } = await supabaseAdmin
      .from("product_images")
      .select("id, product_id, position, products!inner(publish_status)")
      .in("embedding_status", ["pending", "failed"])
      .eq("products.publish_status", "published")
      .limit(5000);

    const remaining = pickPrimaryPending(remainingRows || []).length;

    return new Response(
      JSON.stringify({
        processed,
        batch_size: batchSize,
        remaining,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("backfill-product-embeddings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
