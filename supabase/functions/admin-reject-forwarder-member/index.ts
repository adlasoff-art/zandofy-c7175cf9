/**
 * admin-reject-forwarder-member — reject a pending team request.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  request_id: z.string().uuid(),
  notes: z.string().trim().max(500).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!roles?.some((r: any) => r.role === "admin" || r.role === "manager")) {
      return json({ error: "Forbidden" }, 403);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input" }, 400);

    const { data: row } = await svc
      .from("forwarder_member_requests")
      .select("id, status, forwarder_id, first_name, last_name, forwarders:forwarder_id(owner_user_id)")
      .eq("id", parsed.data.request_id)
      .maybeSingle();
    if (!row || row.status !== "pending") return json({ error: "Demande non pending" }, 409);

    await svc
      .from("forwarder_member_requests")
      .update({
        status: "rejected",
        admin_notes: parsed.data.notes || null,
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.request_id);

    const ownerId = (row as any).forwarders?.owner_user_id;
    if (ownerId) {
      await svc.from("notifications").insert({
        user_id: ownerId,
        type: "system",
        title: "Demande membre refusée",
        message: `${row.first_name} ${row.last_name} — ${parsed.data.notes || "refusée par l'admin"}`,
        link: "/forwarder/team",
      });
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
});
