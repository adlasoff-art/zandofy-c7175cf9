/**
 * forwarder-set-member-password
 * Owner sets password ONLY for members created via admin approve (password_managed_by_owner).
 * Never emails the password in cleartext — owner shares offline or copies from UI once.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  member_id: z.string().uuid(),
  password: z.string().min(8).max(72),
  /** If true, email a notice WITHOUT the password (owner must share it separately). */
  notify_email: z.boolean().optional().default(false),
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
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.zandofy.com";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const ownerId = userData.user.id;

    const svc = createClient(supabaseUrl, serviceKey);
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);

    const { data: member } = await svc
      .from("forwarder_members")
      .select("id, user_id, invited_email, forwarder_id, is_active, password_managed_by_owner")
      .eq("id", parsed.data.member_id)
      .maybeSingle();
    if (!member || !member.is_active) return json({ error: "Membre introuvable" }, 404);

    if (!member.password_managed_by_owner) {
      return json({
        error:
          "Impossible de définir le mot de passe pour ce compte (compte préexistant). Le collaborateur doit utiliser « Mot de passe oublié ».",
        code: "password_not_managed",
      }, 403);
    }

    const { data: fw } = await svc
      .from("forwarders")
      .select("id, name, owner_user_id, status")
      .eq("id", member.forwarder_id)
      .maybeSingle();
    if (!fw || fw.owner_user_id !== ownerId) return json({ error: "Forbidden" }, 403);

    // Never allow resetting the owner's own auth via this path
    if (member.user_id === ownerId) {
      return json({ error: "Action invalide sur le compte propriétaire" }, 400);
    }

    const { error: updErr } = await svc.auth.admin.updateUserById(member.user_id, {
      password: parsed.data.password,
    });
    if (updErr) return json({ error: updErr.message }, 500);

    if (parsed.data.notify_email && member.invited_email) {
      try {
        await sendEmail({
          to: member.invited_email,
          subject: `Accès Zandofy — ${fw.name}`,
          html: `
            <p>Votre responsable a mis à jour l'accès à l'espace transitaire <strong>${fw.name}</strong>.</p>
            <p>Connexion : <a href="${siteUrl}/auth">${siteUrl}/auth</a></p>
            <p>Email : ${member.invited_email}</p>
            <p>Le mot de passe vous sera communiqué par votre responsable (il n'est pas inclus dans cet email pour des raisons de sécurité).</p>
          `,
        });
      } catch (e) {
        console.warn("notify email failed", e);
      }
    }

    // Return password once to the authenticated owner UI only
    return json({ ok: true, password: parsed.data.password });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
});
