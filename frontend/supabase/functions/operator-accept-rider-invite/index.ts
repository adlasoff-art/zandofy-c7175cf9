/**
 * operator-accept-rider-invite
 *
 * Consomme une invitation livreur (token + email) et rattache le user connecté
 * à l'opérateur via `delivery_operator_riders`. Idempotent.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  token: z.string().trim().min(20).max(128),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const reqId = crypto.randomUUID();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Vous devez être connecté pour accepter l'invitation." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Session invalide" }, 401);
    const user = userData.user;
    const userEmail = (user.email || "").toLowerCase();

    let raw: unknown = null;
    try { raw = await req.json(); } catch { return json({ error: "Body JSON invalide" }, 400); }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "Token invalide" }, 400);
    const { token } = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    const { data: invite, error: invErr } = await svc
      .from("delivery_operator_rider_invites")
      .select("id, operator_id, email, vehicle_type, vehicle_plate, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (invErr) {
      console.error(`[accept-rider-invite:${reqId}] fetch error`, invErr);
      return json({ error: "Erreur lecture invitation" }, 500);
    }
    if (!invite) return json({ error: "Invitation introuvable ou déjà utilisée" }, 404);
    if (invite.status === "accepted") {
      return json({ success: true, already_accepted: true, message: "Invitation déjà acceptée." }, 200);
    }
    if (invite.status !== "pending") {
      return json({ error: `Invitation ${invite.status}` }, 410);
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await svc.from("delivery_operator_rider_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return json({ error: "Invitation expirée. Demandez un nouveau lien à l'opérateur." }, 410);
    }
    if (invite.email.toLowerCase() !== userEmail) {
      return json({
        error: `Cette invitation est destinée à ${invite.email}. Connectez-vous avec ce compte.`,
      }, 403);
    }

    // Vérifier qu'il n'est pas déjà rattaché à un autre opérateur
    const { data: existing } = await svc
      .from("delivery_operator_riders")
      .select("id, operator_id, status")
      .eq("rider_user_id", user.id)
      .maybeSingle();
    if (existing && existing.status !== "revoked" && existing.operator_id !== invite.operator_id) {
      return json({ error: "Vous êtes déjà rattaché à un autre opérateur." }, 409);
    }

    if (!existing) {
      const { error: insErr } = await svc.from("delivery_operator_riders").insert({
        operator_id: invite.operator_id,
        rider_user_id: user.id,
        vehicle_type: invite.vehicle_type,
        vehicle_plate: invite.vehicle_plate,
        status: "kyc_required",
      });
      if (insErr) {
        console.error(`[accept-rider-invite:${reqId}] insert rider failed`, insErr);
        return json({ error: `Échec rattachement: ${insErr.message}` }, 500);
      }
    }

    // Ajouter le rôle rider (idempotent)
    await svc.from("user_roles").upsert(
      { user_id: user.id, role: "rider" },
      { onConflict: "user_id,role" },
    );

    // Marquer l'invitation comme acceptée
    await svc.from("delivery_operator_rider_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_user_id: user.id })
      .eq("id", invite.id);

    return json({
      success: true,
      operator_id: invite.operator_id,
      message: "Invitation acceptée. Complétez votre KYC pour activer votre compte livreur.",
    }, 200);
  } catch (e: unknown) {
    console.error(`[accept-rider-invite:${reqId}] error`, e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg, request_id: reqId }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}