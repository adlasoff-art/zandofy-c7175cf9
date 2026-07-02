import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = [
    "https://studio.zandofy.com",
    "https://zandofy.com",
    "https://www.zandofy.com",
  ];
  const isAllowed =
    allowed.includes(origin) ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com") ||
    origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Verify caller is admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const callerId = user.id;

    // Check admin role
    const { data: roleCheck } = await anonClient.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!roleCheck) {
      return jsonResponse({ error: "Forbidden: admin role required" }, 403);
    }

    // Rate limiting: 10 requests/min per admin
    const { data: rlAllowed } = await anonClient.rpc("check_rate_limit", {
      p_identifier: callerId,
      p_endpoint: "admin-users",
      p_max_requests: 10,
      p_window_seconds: 60,
    });
    if (rlAllowed === false) {
      return jsonResponse({ error: "Too many requests. Please wait." }, 429);
    }

    // Service role client for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, userId, ...params } = await req.json();

    const OPERATIONAL_ROLES = ["vendor", "shipper", "rider", "operator", "forwarder"];

    async function assertOperationalTarget(targetUserId: string) {
      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);
      const roles = targetRoles?.map((r: { role: string }) => r.role) ?? [];
      if (roles.includes("admin")) {
        return { error: "Impossible de modifier les identifiants d'un administrateur via cette action" };
      }
      if (!roles.some((r) => OPERATIONAL_ROLES.includes(r))) {
        return {
          error: "Action réservée aux comptes avec rôle opérationnel (vendeur, livreur, transporteur, etc.)",
        };
      }
      return { roles };
    }

    switch (action) {
      case "reset_password": {
        // Get user email
        const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(userId);
        if (userErr || !userData?.user?.email) {
          return jsonResponse({ error: "User not found" }, 404);
        }
        const userEmail = userData.user.email;

        // Generate recovery link
        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: userEmail,
        });
        if (linkErr) {
          console.error("generateLink error:", linkErr.message);
          return jsonResponse({ error: linkErr.message }, 500);
        }

        const actionLink = linkData?.properties?.action_link;
        if (!actionLink) {
          return jsonResponse({ error: "Could not generate recovery link" }, 500);
        }

        await sendEmail({          to: userEmail,
          subject: "Réinitialisation de votre mot de passe - Zandofy",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#008000;">Zandofy</h2>
              <p>Bonjour,</p>
              <p>Un administrateur a demandé la réinitialisation de votre mot de passe.</p>
              <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${actionLink}" style="background-color:#008000;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-size:16px;display:inline-block;">
                  Réinitialiser mon mot de passe
                </a>
              </div>
              <p style="color:#666;font-size:13px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
              <p style="color:#666;font-size:13px;">Ce lien expire dans 24 heures.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
              <p style="color:#999;font-size:12px;">© Zandofy - Marketplace Mode Africaine</p>
            </div>
          `,
        });

        return jsonResponse({ success: true, email: userEmail });
      }

      case "set_operational_credentials": {
        const { email, password, revokeOAuth } = params as {
          email?: string;
          password?: string;
          revokeOAuth?: boolean;
        };

        const targetCheck = await assertOperationalTarget(userId);
        if ("error" in targetCheck && targetCheck.error) {
          return jsonResponse({ error: targetCheck.error }, 403);
        }

        const authUpdates: {
          email?: string;
          password?: string;
          email_confirm?: boolean;
        } = {};

        if (typeof email === "string" && email.trim()) {
          authUpdates.email = email.trim().toLowerCase();
          authUpdates.email_confirm = true;
        }

        if (typeof password === "string" && password.length > 0) {
          if (password.length < 8) {
            return jsonResponse({ error: "Le mot de passe doit contenir au moins 8 caractères" }, 400);
          }
          authUpdates.password = password;
        }

        if (!authUpdates.email && !authUpdates.password) {
          return jsonResponse({ error: "Email ou mot de passe requis" }, 400);
        }

        const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, authUpdates);
        if (updateErr) {
          console.error("set_operational_credentials updateUserById:", updateErr.message);
          return jsonResponse({ error: updateErr.message }, 500);
        }

        const { error: syncErr } = await adminClient.rpc("admin_post_credentials_sync", {
          p_user_id: userId,
          p_email: authUpdates.email ?? null,
          p_revoke_oauth: Boolean(revokeOAuth),
        });
        if (syncErr) {
          console.error("admin_post_credentials_sync:", syncErr.message);
          return jsonResponse({
            error: "Identifiants Auth mis à jour mais synchronisation incomplète. Appliquez la migration admin_post_credentials_sync.",
          }, 500);
        }

        return jsonResponse({
          success: true,
          email: authUpdates.email ?? null,
          passwordUpdated: Boolean(authUpdates.password),
          oauthRevoked: Boolean(revokeOAuth),
        });
      }

      case "ban_user": {
        const { reason } = params;
        const { error: banErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "876600h",
        });
        if (banErr) {
          return jsonResponse({ error: banErr.message }, 500);
        }
        await adminClient.from("profiles").update({
          is_banned: true,
          ban_reason: reason || "Violation des conditions d'utilisation",
          banned_at: new Date().toISOString(),
          banned_by: callerId,
        }).eq("id", userId);

        return jsonResponse({ success: true });
      }

      case "unban_user": {
        const { error: unbanErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (unbanErr) {
          return jsonResponse({ error: unbanErr.message }, 500);
        }
        await adminClient.from("profiles").update({
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          banned_by: null,
        }).eq("id", userId);

        return jsonResponse({ success: true });
      }

      case "get_user_details": {
        const { data: authUser, error: authErr } = await adminClient.auth.admin.getUserById(userId);
        if (authErr) {
          return jsonResponse({ error: authErr.message }, 500);
        }
        return jsonResponse({
          last_sign_in_at: authUser.user.last_sign_in_at,
          created_at: authUser.user.created_at,
          email_confirmed_at: authUser.user.email_confirmed_at,
          banned_until: authUser.user.banned_until,
          providers: authUser.user.app_metadata?.providers || [],
        });
      }

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
