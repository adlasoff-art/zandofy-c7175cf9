/**
 * operator-invite-rider — Lot 11B Phase B2
 *
 * Invite un livreur à rejoindre la flotte d'un opérateur.
 * - Auth : owner de l'opérateur uniquement.
 * - Vérifie quota max_riders, statut approved, pas déjà invité.
 * - Crée la ligne `delivery_operator_riders` (status = 'pending').
 * - Envoie un email d'invitation via SMTP Hostinger.
 * - Si user existe déjà, lui ajoute le rôle `rider`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  rider_email: z.string().trim().email().max(160),
  vehicle_type: z.enum(["moto", "voiture", "camionnette", "velo"]).default("moto"),
  vehicle_plate: z.string().trim().max(20).optional().nullable(),
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
    const { rider_email, vehicle_type, vehicle_plate } = parsed.data;

    const svc = createClient(supabaseUrl, serviceKey);

    // Récupérer l'opérateur du user (owner)
    const { data: op } = await svc
      .from("delivery_operators")
      .select("id, company_name, max_riders, status, is_active")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!op) return json({ error: "Aucun opérateur trouvé pour cet utilisateur" }, 403);
    if (op.status !== "approved" || !op.is_active) {
      return json({ error: "Opérateur non approuvé/actif" }, 403);
    }

    // Vérifier quota
    const { count: ridersCount } = await svc
      .from("delivery_operator_riders")
      .select("id", { count: "exact", head: true })
      .eq("operator_id", op.id)
      .in("status", ["pending", "active"]);
    if ((ridersCount ?? 0) >= op.max_riders) {
      return json({ error: `Quota livreurs atteint (${op.max_riders}). Demandez une augmentation.` }, 409);
    }

    // Vérifier si user existe par email
    const { data: profile } = await svc
      .from("profiles")
      .select("id")
      .eq("email", rider_email.toLowerCase())
      .maybeSingle();

    let riderUserId = profile?.id ?? null;

    // Anti-doublon
    if (riderUserId) {
      const { data: existing } = await svc
        .from("delivery_operator_riders")
        .select("id")
        .eq("operator_id", op.id)
        .eq("rider_user_id", riderUserId)
        .in("status", ["pending", "active"])
        .maybeSingle();
      if (existing) return json({ error: "Ce livreur est déjà invité ou actif" }, 409);
    }

    if (riderUserId) {
      // Insérer invitation
      const { error: insErr } = await svc.from("delivery_operator_riders").insert({
        operator_id: op.id,
        rider_user_id: riderUserId,
        vehicle_type,
        vehicle_plate: vehicle_plate ?? null,
        status: "pending",
      });
      if (insErr) return json({ error: insErr.message }, 500);

      // Octroi rôle rider
      await svc.from("user_roles").upsert(
        { user_id: riderUserId, role: "rider" },
        { onConflict: "user_id,role" },
      );
    }

    // Email d'invitation

    if (fromEmail) {
      try {

        const ctaUrl = riderUserId
          ? "https://zandofy.com/rider"
          : "https://zandofy.com/auth?redirect=/rider";

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

        await sendEmail({          to: rider_email,
          subject: `Zandofy — Invitation livreur (${op.company_name})`,
          html,
        });
      } catch (mailErr) {
        console.warn("[operator-invite-rider] email send failed", mailErr);
      }
    }

    return json({
      success: true,
      pending_signup: !riderUserId,
      message: riderUserId
        ? "Invitation envoyée et compte livreur préparé."
        : "Email d'invitation envoyé. Le livreur doit créer son compte avant l'activation.",
    }, 200);
  } catch (e: unknown) {
    console.error("[operator-invite-rider] error", e);
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}