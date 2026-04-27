/**
 * admin-review-kyb-document — Lot final consolidation
 *
 * Approuve ou rejette un document KYB d'opérateur. Notifie l'owner.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  document_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  rejection_reason: z.string().max(500).optional(),
});

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
    const adminId = userData.user.id;

    const svc = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", adminId);
    const isStaff = roles?.some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const { document_id, decision, rejection_reason } = parsed.data;

    if (decision === "rejected" && (!rejection_reason || rejection_reason.trim().length < 3)) {
      return json({ error: "Motif de rejet requis (min 3 caractères)" }, 400);
    }

    const { data: doc, error: docErr } = await svc
      .from("operator_kyb_documents")
      .select("id, status, operator_id, doc_type")
      .eq("id", document_id)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Document introuvable" }, 404);

    const { error: updErr } = await svc
      .from("operator_kyb_documents")
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        rejection_reason: decision === "rejected" ? rejection_reason : null,
      })
      .eq("id", document_id);
    if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

    // Notif owner
    try {
      const { data: op } = await svc
        .from("delivery_operators")
        .select("owner_user_id, company_name")
        .eq("id", doc.operator_id)
        .maybeSingle();
      if (op?.owner_user_id) {
        await svc.from("notifications").insert({
          user_id: op.owner_user_id,
          type: decision === "approved" ? "operator_kyb_doc_approved" : "operator_kyb_doc_rejected",
          title: decision === "approved" ? "Document KYB approuvé" : "Document KYB rejeté",
          message:
            decision === "approved"
              ? `Votre ${doc.doc_type.toUpperCase()} a été validé.`
              : `Votre ${doc.doc_type.toUpperCase()} a été rejeté : ${rejection_reason}`,
          link: "/operator/settings",
        });
      }
    } catch (e) {
      console.warn("[admin-review-kyb-document] notif failed", e);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[admin-review-kyb-document] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}