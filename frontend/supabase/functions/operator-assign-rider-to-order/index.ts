/**
 * operator-assign-rider-to-order — Lot 11B Phase B2
 *
 * Assigne un rider de la flotte d'un opérateur à une commande.
 * - Auth : owner de l'opérateur uniquement.
 * - Vérifie : commande appartient à cet opérateur, rider actif dans la flotte.
 * - Met à jour orders.assigned_rider_id.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  order_id: z.string().uuid(),
  rider_user_id: z.string().uuid(),
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
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const { order_id, rider_user_id } = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    // Récupérer l'opérateur du user (owner)
    const { data: op } = await svc
      .from("delivery_operators")
      .select("id, status, is_active")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!op) return json({ error: "Aucun opérateur trouvé" }, 403);
    if (op.status !== "approved" || !op.is_active) {
      return json({ error: "Opérateur non approuvé/actif" }, 403);
    }

    // Vérifier que la commande appartient à cet opérateur
    const { data: order } = await svc
      .from("orders")
      .select("id, delivery_operator_id, assigned_rider_id, status")
      .eq("id", order_id)
      .maybeSingle();
    if (!order) return json({ error: "Commande introuvable" }, 404);
    if (order.delivery_operator_id !== op.id) {
      return json({ error: "Cette commande n'appartient pas à votre opérateur" }, 403);
    }

    // Vérifier rider actif dans la flotte
    const { data: rider } = await svc
      .from("delivery_operator_riders")
      .select("id, status")
      .eq("operator_id", op.id)
      .eq("rider_user_id", rider_user_id)
      .eq("status", "active")
      .maybeSingle();
    if (!rider) return json({ error: "Rider non trouvé ou inactif dans votre flotte" }, 403);

    // Assignation
    const { error: updErr } = await svc
      .from("orders")
      .update({ assigned_rider_id: rider_user_id, assigned_at: new Date().toISOString() })
      .eq("id", order_id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Notification rider (best-effort)
    try {
      await svc.from("notifications").insert({
        user_id: rider_user_id,
        type: "order_assigned",
        title: "Nouvelle course assignée",
        message: `Une course vient de vous être assignée par votre opérateur.`,
        link: "/rider",
      });
    } catch (e) {
      console.warn("[operator-assign-rider-to-order] notif failed", e);
    }

    return json({ success: true, order_id, rider_user_id }, 200);
  } catch (e: unknown) {
    console.error("[operator-assign-rider-to-order] error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}