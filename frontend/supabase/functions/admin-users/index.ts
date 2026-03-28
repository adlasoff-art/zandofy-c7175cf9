import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getCorsHeaders(req: Request) {
  const siteBase = Deno.env.get("SITE_BASE_URL") || "*";
  const origin = req.headers.get("Origin") || "";
  const allowed = siteBase === "*" || origin === siteBase;
  return {
    "Access-Control-Allow-Origin": allowed ? origin || "*" : siteBase,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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

    // Service role client for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, userId, ...params } = await req.json();

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

        // Build the redirect URL from the generated link
        const actionLink = linkData?.properties?.action_link;
        if (!actionLink) {
          return jsonResponse({ error: "Could not generate recovery link" }, 500);
        }

        // Send the email via SMTP (same as send-email function)
        const smtpHost = Deno.env.get("SMTP_HOST");
        const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
        const smtpUser = Deno.env.get("SMTP_USER");
        const smtpPass = Deno.env.get("SMTP_PASS");

        if (!smtpHost || !smtpUser || !smtpPass) {
          console.error("Missing SMTP secrets:", { hasHost: !!smtpHost, hasUser: !!smtpUser, hasPass: !!smtpPass });
          return jsonResponse({ error: "SMTP configuration missing. Please configure SMTP secrets." }, 500);
        }

        const nodemailer = (await import("npm:nodemailer@6.9.16")).default;
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") || "noreply@zandofy.com";

        await transporter.sendMail({
          from: `"Zandofy" <${fromEmail}>`,
          to: userEmail,
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

      case "ban_user": {
        const { reason } = params;
        // Disable auth account
        const { error: banErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "876600h", // ~100 years
        });
        if (banErr) {
          return jsonResponse({ error: banErr.message }, 500);
        }
        // Update profile
        await adminClient.from("profiles").update({
          is_banned: true,
          ban_reason: reason || "Violation des conditions d'utilisation",
          banned_at: new Date().toISOString(),
          banned_by: callerId,
        }).eq("id", userId);

        return jsonResponse({ success: true });
      }

      case "unban_user": {
        // Re-enable auth account
        const { error: unbanErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (unbanErr) {
          return jsonResponse({ error: unbanErr.message }, 500);
        }
        // Update profile
        await adminClient.from("profiles").update({
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          banned_by: null,
        }).eq("id", userId);

        return jsonResponse({ success: true });
      }

      case "get_user_details": {
        // Get auth user details (last sign in, created at, etc.)
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
