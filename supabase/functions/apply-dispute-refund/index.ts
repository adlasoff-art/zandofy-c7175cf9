/**
 * apply-dispute-refund — Lot 13
 *
 * Applique un remboursement (wallet client OU cash/original_method) sur un litige.
 * Trois modes :
 *  1) admin direct  : action='apply'  (admin uniquement)
 *  2) vendor propose: action='propose' (vendeur uniquement)
 *  3) client respond: action='accept' | 'reject' (client propriétaire uniquement)
 *
 * Utilise la fonction SQL public.apply_dispute_refund() pour la mécanique
 * transactionnelle (wallet credit + payment_transactions + close dispute).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  dispute_id: z.string().uuid(),
  action: z.enum(["apply", "propose", "accept", "reject"]),
  amount: z.number().positive().optional(),
  method: z.enum(["wallet", "cash", "original_method"]).optional(),
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
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { dispute_id, action, amount, method } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // Load dispute + order + store
    const { data: dispute, error: dErr } = await admin
      .from("disputes")
      .select("id, user_id, store_id, order_id, status, proposed_refund_amount, proposed_refund_method, proposed_refund_status")
      .eq("id", dispute_id)
      .maybeSingle();
    if (dErr || !dispute) return json({ error: "Dispute not found" }, 404);

    const { data: store } = await admin
      .from("stores")
      .select("owner_id")
      .eq("id", dispute.store_id!)
      .maybeSingle();

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r) => r.role === "admin" || r.role === "manager");
    const isVendor = store?.owner_id === userId;
    const isClient = dispute.user_id === userId;

    if (action === "apply") {
      if (!isAdmin) return json({ error: "Only admin can apply refund directly" }, 403);
      if (!amount || !method) return json({ error: "amount and method required" }, 400);
      const { data, error } = await admin.rpc("apply_dispute_refund", {
        p_dispute_id: dispute_id,
        p_amount: amount,
        p_method: method,
        p_actor: userId,
      });
      if (error) return json({ error: error.message }, 400);
      await notify(admin, dispute.user_id, "dispute_refund_applied",
        "Remboursement appliqué", `Un remboursement de ${amount} a été appliqué à votre litige.`,
        { dispute_id, amount, method });
      return json({ ok: true, ...((data as any) || {}) });
    }

    if (action === "propose") {
      if (!isVendor && !isAdmin) return json({ error: "Only vendor or admin can propose" }, 403);
      if (!amount || !method) return json({ error: "amount and method required" }, 400);
      const { error } = await admin
        .from("disputes")
        .update({
          proposed_refund_amount: amount,
          proposed_refund_method: method,
          proposed_refund_by: userId,
          proposed_refund_at: new Date().toISOString(),
          proposed_refund_status: "pending",
        })
        .eq("id", dispute_id);
      if (error) return json({ error: error.message }, 400);
      await notify(admin, dispute.user_id, "dispute_refund_proposed",
        "Proposition de remboursement",
        `Le vendeur vous propose un remboursement de ${amount} (${method}). Acceptez ou refusez dans le litige.`,
        { dispute_id, amount, method });
      return json({ ok: true });
    }

    if (action === "accept" || action === "reject") {
      if (!isClient) return json({ error: "Only the client can respond" }, 403);
      if (dispute.proposed_refund_status !== "pending") {
        return json({ error: "No pending proposal" }, 400);
      }

      if (action === "reject") {
        await admin.from("disputes").update({ proposed_refund_status: "rejected" }).eq("id", dispute_id);
        if (store?.owner_id) {
          await notify(admin, store.owner_id, "dispute_refund_rejected",
            "Proposition refusée",
            "Le client a refusé votre proposition de remboursement.",
            { dispute_id });
        }
        return json({ ok: true });
      }

      // accept → apply
      const { data, error } = await admin.rpc("apply_dispute_refund", {
        p_dispute_id: dispute_id,
        p_amount: dispute.proposed_refund_amount,
        p_method: dispute.proposed_refund_method,
        p_actor: userId,
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("disputes").update({ proposed_refund_status: "accepted" }).eq("id", dispute_id);
      if (store?.owner_id) {
        await notify(admin, store.owner_id, "dispute_refund_accepted",
          "Proposition acceptée",
          "Le client a accepté la proposition. Le remboursement a été appliqué.",
          { dispute_id });
      }
      return json({ ok: true, ...((data as any) || {}) });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("[apply-dispute-refund] uncaught", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function notify(
  admin: ReturnType<typeof createClient>,
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata: Record<string, unknown>,
) {
  try {
    await admin.from("notifications").insert({ user_id: userId, type, title, body, metadata });
  } catch (_) { /* best-effort */ }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}