import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isStaff = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "manager",
    );
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    // Safety floor: never delete data fresher than 7 days, even if a smaller value is passed.
    const days = Math.max(7, Math.min(3650, parseInt(String(body?.older_than_days ?? "30"), 10) || 30));
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

    // 1. Fetch requests to delete (to gather image paths)
    const { data: oldRequests, error: fetchErr } = await supabase
      .from("product_sourcing_requests")
      .select("id, images")
      .lt("created_at", cutoff);
    if (fetchErr) throw fetchErr;

    const allImagePaths: string[] = [];
    for (const r of oldRequests ?? []) {
      const imgs = Array.isArray((r as any).images) ? (r as any).images : [];
      for (const p of imgs) {
        if (typeof p === "string" && p.length > 0) allImagePaths.push(p);
      }
    }

    // 2. Delete storage files in batches of 100
    let removedFiles = 0;
    for (let i = 0; i < allImagePaths.length; i += 100) {
      const batch = allImagePaths.slice(i, i + 100);
      const { error: rmErr } = await supabase.storage
        .from("sourcing-images")
        .remove(batch);
      if (!rmErr) removedFiles += batch.length;
    }

    // 3. Delete DB rows (responses cascade via FK)
    const { error: delErr, count } = await supabase
      .from("product_sourcing_requests")
      .delete({ count: "exact" })
      .lt("created_at", cutoff);
    if (delErr) throw delErr;

    return new Response(
      JSON.stringify({
        success: true,
        deleted_requests: count ?? 0,
        removed_files: removedFiles,
        cutoff,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("cleanup-sourcing error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});