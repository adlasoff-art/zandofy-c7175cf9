/**
 * admin-approve-forwarder-member
 * Approves a forwarder_member_request: creates NEW auth user + forwarder_members + email.
 * Refuses existing accounts (no silent attach / no password takeover).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { sendEmail } from "../_shared/email.ts";

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

function randomPassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
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
    const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_SITE_URL") || "https://www.zandofy.com";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const adminId = userData.user.id;

    const svc = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", adminId);
    const isStaff = roles?.some((r: { role: string }) => r.role === "admin" || r.role === "manager");
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    const { request_id, notes } = parsed.data;

    const { data: reqRow, error: reqErr } = await svc
      .from("forwarder_member_requests")
      .select("*, forwarders:forwarder_id(id, name, owner_user_id)")
      .eq("id", request_id)
      .maybeSingle();
    if (reqErr || !reqRow) return json({ error: "Demande introuvable" }, 404);
    if (reqRow.status !== "pending") {
      return json({ error: `Statut actuel: ${reqRow.status}` }, 409);
    }

    const email = String(reqRow.email).trim().toLowerCase();

    // Exact email match — refuse attaching an existing customer/vendor account
    const { data: existingProfile } = await svc
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      return json({
        error:
          "Un compte Zandofy existe déjà pour cet email. Utilisez un email dédié collaborateur (ex: prenom.transitaire@…), puis re-soumettez la demande.",
        code: "email_already_registered",
      }, 409);
    }

    const password = randomPassword(14);
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: reqRow.first_name,
        last_name: reqRow.last_name,
        full_name: `${reqRow.first_name} ${reqRow.last_name}`,
        created_via: "forwarder_member_request",
      },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message || "Échec création compte";
      if (/already|registered|exists/i.test(msg)) {
        return json({
          error: "Email déjà utilisé. Utilisez un email dédié collaborateur.",
          code: "email_already_registered",
        }, 409);
      }
      return json({ error: msg }, 500);
    }
    const userId = created.user.id;

    await svc.from("profiles").upsert({
      id: userId,
      email,
      first_name: reqRow.first_name,
      last_name: reqRow.last_name,
    }, { onConflict: "id" });

    const { error: roleErr } = await svc.from("user_roles").insert({
      user_id: userId,
      role: "forwarder",
    });
    if (roleErr && !String(roleErr.message || "").toLowerCase().includes("duplicate")) {
      console.warn("role insert", roleErr.message);
    }

    const { data: member, error: memErr } = await svc
      .from("forwarder_members")
      .upsert(
        {
          forwarder_id: reqRow.forwarder_id,
          user_id: userId,
          role: reqRow.role,
          invited_email: email,
          is_active: true,
          password_managed_by_owner: true,
        },
        { onConflict: "forwarder_id,user_id" },
      )
      .select("id")
      .single();
    if (memErr) return json({ error: memErr.message }, 500);

    await svc
      .from("forwarder_member_requests")
      .update({
        status: "approved",
        admin_notes: notes || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        created_user_id: userId,
        member_id: member.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .eq("status", "pending");

    const fwName = (reqRow as any).forwarders?.name || "votre transitaire";
    const loginUrl = `${siteUrl}/auth`;

    // Never email the password — owner sets it in /forwarder/team
    try {
      await sendEmail({
        to: email,
        subject: `Accès équipe Zandofy — ${fwName}`,
        html: `
          <p>Bonjour ${reqRow.first_name},</p>
          <p>Votre compte collaborateur pour <strong>${fwName}</strong> a été validé par Zandofy.</p>
          <p>Connexion : <a href="${loginUrl}">${loginUrl}</a></p>
          <p>Email : <strong>${email}</strong></p>
          <p>Votre responsable définira le mot de passe et vous le communiquera (ou via « Mot de passe oublié » sur la page de connexion).</p>
          <p>— Zandofy</p>
        `,
      });
    } catch (e) {
      console.warn("email failed", e);
    }

    const ownerId = (reqRow as any).forwarders?.owner_user_id;
    if (ownerId) {
      await svc.from("notifications").insert({
        user_id: ownerId,
        type: "system",
        title: "Membre d'équipe approuvé",
        message: `${reqRow.first_name} ${reqRow.last_name} (${email}) est approuvé. Définissez son mot de passe dans Équipe.`,
        link: "/forwarder/team",
      });
    }

    return json({
      ok: true,
      user_id: userId,
      member_id: member.id,
      created_new_user: true,
    });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message || "Server error" }, 500);
  }
});
