/**
 * operator-invite-rider — Lot 11B Phase B2
 *
 * Invite un livreur à rejoindre la flotte d'un opérateur.
 * - Auth : owner de l'opérateur uniquement.
 * - Vérifie quota max_riders + invitations ouvertes, statut approved.
 * - Si l'utilisateur existe déjà : crée `delivery_operator_riders` (pending) + rôle rider + email direct.
 * - Sinon : crée une ligne `delivery_operator_rider_invites` avec token + email d'invitation.
 * Retourne TOUJOURS un JSON explicite (success/error + message).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  rider_email: z.string().trim().email().max(160).optional(),
  email: z.string().trim().email().max(160).optional(),
  vehicle_type: z.enum(["moto", "voiture", "tricycle", "camionnette", "velo"]).default("moto"),
  vehicle_plate: z.string().trim().max(20).optional().nullable(),
  full_name: z.string().trim().max(160).optional(),
  operator_id: z.string().uuid().optional(),
}).refine((d) => !!(d.rider_email || d.email), { message: "rider_email ou email requis" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const reqId = crypto.randomUUID();
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

    let rawBody: unknown = null;
    try { rawBody = await req.json(); } catch { return json({ error: "Body JSON invalide" }, 400); }
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const rider_email = (parsed.data.rider_email || parsed.data.email)!.toLowerCase();
    const { vehicle_type, vehicle_plate, operator_id: requestedOperatorId } = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    // Vérifier rôle admin (autorise override operator_id)
    const { data: roleRows } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roleRows ?? []).some((r: { role: string }) => r.role === "admin");

    // Résoudre l'opérateur : operator_id explicite (admin OU owner) sinon lookup par owner
    let op: { id: string; company_name: string; max_riders: number; status: string; is_active: boolean; owner_user_id: string } | null = null;
    if (requestedOperatorId) {
      const { data } = await svc
        .from("delivery_operators")
        .select("id, company_name, max_riders, status, is_active, owner_user_id")
        .eq("id", requestedOperatorId)
        .maybeSingle();
      op = data as typeof op;
      if (!op) return json({ error: "Opérateur introuvable", operator_id: requestedOperatorId, auth_user_id: userId }, 404);
      if (!isAdmin && op.owner_user_id !== userId) {
        return json({ error: "Vous n'êtes pas owner de cet opérateur", auth_user_id: userId }, 403);
      }
    } else {
      const { data } = await svc
        .from("delivery_operators")
        .select("id, company_name, max_riders, status, is_active, owner_user_id")
        .eq("owner_user_id", userId)
        .maybeSingle();
      op = data as typeof op;
      if (!op) {
        return json({
          error: "Aucun opérateur trouvé pour cet utilisateur. Si vous êtes admin, passez operator_id dans la requête ; sinon vérifiez que votre compte est bien owner d'un opérateur.",
          auth_user_id: userId,
          is_admin: isAdmin,
          hint: "Vérifiez en SQL: select id, owner_user_id from public.delivery_operators where owner_user_id = '" + userId + "';",
        }, 404);
      }
    }
    if (op.status !== "approved" || !op.is_active) {
      return json({ error: "Opérateur non approuvé/actif", status: op.status, is_active: op.is_active }, 403);
    }

    // Quota = riders actifs/pending + invitations ouvertes
    const { count: ridersCount } = await svc
      .from("delivery_operator_riders")
      .select("id", { count: "exact", head: true })
      .eq("operator_id", op.id)
      .in("status", ["pending", "kyc_required", "active"]);
    const { count: invitesCount } = await svc
      .from("delivery_operator_rider_invites")
      .select("id", { count: "exact", head: true })
      .eq("operator_id", op.id)
      .eq("status", "pending");
    const used = (ridersCount ?? 0) + (invitesCount ?? 0);
    if (used >= op.max_riders) {
      return json({ error: `Quota livreurs atteint (${op.max_riders}). Demandez une augmentation.` }, 409);
    }

    // Vérifier si user existe par email
    const { data: profile } = await svc
      .from("profiles")
      .select("id")
      .ilike("email", rider_email)
      .maybeSingle();

    let riderUserId = profile?.id ?? null;

    let inviteToken: string | null = null;
    let riderRowCreated = false;

    if (riderUserId) {
      // Anti-doublon : déjà rattaché ?
      const { data: existing } = await svc
        .from("delivery_operator_riders")
        .select("id, status")
        .eq("rider_user_id", riderUserId)
        .maybeSingle();
      if (existing && existing.status !== "revoked") {
        return json({ error: "Ce livreur est déjà rattaché à un opérateur" }, 409);
      }

      // Insérer le rattachement (la contrainte UNIQUE rider_user_id force une seule appartenance)
      const { error: insErr } = await svc.from("delivery_operator_riders").insert({
        operator_id: op.id,
        rider_user_id: riderUserId,
        vehicle_type,
        vehicle_plate: vehicle_plate ?? null,
        status: "kyc_required",
      });
      if (insErr) {
        console.error(`[operator-invite-rider:${reqId}] insert rider failed`, insErr);
        return json({ error: `Échec rattachement livreur: ${insErr.message}` }, 500);
      }
      riderRowCreated = true;

      // Octroi rôle rider (idempotent)
      const { error: roleErr } = await svc.from("user_roles").upsert(
        { user_id: riderUserId, role: "rider" },
        { onConflict: "user_id,role" },
      );
      if (roleErr) console.warn(`[operator-invite-rider:${reqId}] role upsert warn`, roleErr.message);
    } else {
      // Pas de compte : créer / rafraîchir une invitation
      // Révoquer toute invitation pendante existante pour cet (operator,email)
      await svc.from("delivery_operator_rider_invites")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("operator_id", op.id)
        .ilike("email", rider_email)
        .eq("status", "pending");

      inviteToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { error: invErr } = await svc.from("delivery_operator_rider_invites").insert({
        operator_id: op.id,
        email: rider_email,
        vehicle_type,
        vehicle_plate: vehicle_plate ?? null,
        token: inviteToken,
        invited_by: userId,
        status: "pending",
      });
      if (invErr) {
        console.error(`[operator-invite-rider:${reqId}] insert invite failed`, invErr);
        return json({ error: `Échec création invitation: ${invErr.message}` }, 500);
      }
    }

    // Email d'invitation (best-effort : un échec n'invalide pas l'invitation/rattachement)
    let emailOk = true;
    let emailError: string | null = null;
    try {
      const ctaUrl = riderUserId
        ? "https://zandofy.com/rider"
        : `https://zandofy.com/rider-invite?token=${inviteToken}&email=${encodeURIComponent(rider_email)}`;

      const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;color:#111;">
            <h2 style="margin:0 0 16px;color:#0f172a;">Invitation livreur — ${escapeHtml(op.company_name)}</h2>
            <p>Bonjour,</p>
            <p><strong>${escapeHtml(op.company_name)}</strong> vous invite à rejoindre sa flotte de livreurs sur la plateforme Zandofy.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr><td style="padding:6px 0;color:#666;">Opérateur</td><td style="padding:6px 0;"><strong>${escapeHtml(op.company_name)}</strong></td></tr>
              <tr><td style="padding:6px 0;color:#666;">Type de véhicule</td><td style="padding:6px 0;">${vehicle_type}</td></tr>
              ${vehicle_plate ? `<tr><td style="padding:6px 0;color:#666;">Plaque</td><td style="padding:6px 0;">${escapeHtml(vehicle_plate)}</td></tr>` : ""}
            </table>
            <p>Pour activer votre compte livreur, complétez votre KYC (pièce d'identité) puis acceptez l'invitation depuis votre tableau de bord.</p>
            <p><a href="${ctaUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${riderUserId ? "Accéder à mon dashboard" : "Créer mon compte livreur"}</a></p>
            <p style="color:#888;font-size:12px;margin-top:32px;">Email envoyé automatiquement par Zandofy. Si vous n'attendiez pas cette invitation, ignorez ce message.</p>
          </div>
        `;
      const result = await sendEmail({
        to: rider_email,
        subject: `Zandofy — Invitation livreur (${op.company_name})`,
        html,
      });
      if (!result.ok) {
        emailOk = false;
        emailError = result.error || `HTTP ${result.status}`;
        console.warn(`[operator-invite-rider:${reqId}] email send not ok`, emailError);
      }
    } catch (mailErr: unknown) {
      emailOk = false;
      emailError = mailErr instanceof Error ? mailErr.message : "email error";
      console.warn(`[operator-invite-rider:${reqId}] email send failed`, emailError);
    }

    return json({
      success: true,
      request_id: reqId,
      rider_created: riderRowCreated,
      pending_signup: !riderUserId,
      email_sent: emailOk,
      email_error: emailError,
      message: riderUserId
        ? (emailOk
            ? "Livreur ajouté à la flotte. Email d'activation envoyé."
            : "Livreur ajouté à la flotte (email non envoyé, prévenez-le manuellement).")
        : (emailOk
            ? "Invitation enregistrée. Le livreur doit créer son compte via le lien reçu par email."
            : "Invitation enregistrée mais email non envoyé. Partagez le lien manuellement."),
    }, 200);
  } catch (e: unknown) {
    console.error(`[operator-invite-rider:${reqId}] unhandled error`, e);
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}