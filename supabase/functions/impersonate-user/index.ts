import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigins = [
    "https://zandofy.com",
    "https://www.zandofy.com",
  ];
  const siteBase = Deno.env.get("SITE_BASE_URL");
  if (siteBase && !allowedOrigins.includes(siteBase)) {
    allowedOrigins.push(siteBase);
  }
  const isAllowed =
    allowedOrigins.includes(origin) ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com") ||
    origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Create a user session via admin generateLink + anon verifyOtp (service role verifyOtp fails). */
async function createSessionForEmail(
  supabaseUrl: string,
  supabaseAnonKey: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData?.properties) {
    console.error("generateLink error:", linkError);
    return { error: linkError?.message || "Failed to generate session" };
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  const hashedToken = linkData.properties.hashed_token;
  const emailOtp = linkData.properties.email_otp;
  let lastError = "Failed to create session (verifyOtp)";

  if (hashedToken) {
    for (const type of ["magiclink", "email"] as const) {
      const { data: sessionData, error: verifyError } = await supabaseAuth.auth.verifyOtp({
        token_hash: hashedToken,
        type,
      });
      if (!verifyError && sessionData?.session) {
        return { session: sessionData.session };
      }
      if (verifyError) {
        console.error(`verifyOtp token_hash/${type} failed:`, verifyError);
        lastError = verifyError.message;
      }
    }
  }

  if (emailOtp) {
    for (const type of ["magiclink", "email"] as const) {
      const { data: sessionData, error: verifyError } = await supabaseAuth.auth.verifyOtp({
        email,
        token: emailOtp,
        type,
      });
      if (!verifyError && sessionData?.session) {
        return { session: sessionData.session };
      }
      if (verifyError) {
        console.error(`verifyOtp email_otp/${type} failed:`, verifyError);
        lastError = verifyError.message;
      }
    }
  }

  return { error: lastError };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, targetUserId, token: impersonationToken, adminAccessToken, adminRefreshToken } = await req.json();

    // ─── ACTION: start ───
    if (action === "start") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !authUser) {
        return jsonResponse({ error: "Invalid token" }, 401, corsHeaders);
      }

      const adminId = authUser.id;

      // Check admin/manager role
      const { data: adminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", adminId);

      const isAdmin = adminRoles?.some((r: any) => r.role === "admin");
      const isManager = adminRoles?.some((r: any) => r.role === "manager");
      if (!isAdmin && !isManager) {
        return jsonResponse({ error: "Admin or manager role required" }, 403, corsHeaders);
      }

      if (!targetUserId) {
        return jsonResponse({ error: "targetUserId required" }, 400, corsHeaders);
      }

      // Manager cannot impersonate admin
      if (isManager && !isAdmin) {
        const { data: targetRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", targetUserId);
        if (targetRoles?.some((r: any) => r.role === "admin")) {
          return jsonResponse({ error: "Managers cannot impersonate admins" }, 403, corsHeaders);
        }
      }

      // Verify target exists
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name")
        .eq("id", targetUserId)
        .single();

      if (!targetProfile) {
        return jsonResponse({ error: "User not found" }, 404, corsHeaders);
      }

      // Generate a random token
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const tokenStr = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");

      // Hash token before storing (never store plaintext)
      const tokenHash = await sha256Hex(tokenStr);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: insertError } = await supabaseAdmin.from("impersonation_tokens").insert({
        token_hash: tokenHash,
        admin_id: adminId,
        target_user_id: targetUserId,
        expires_at: expiresAt,
      });
      if (insertError) {
        console.error("impersonation_tokens insert failed:", insertError);
        return jsonResponse({ error: "Impossible de créer le token d'impersonation" }, 500, corsHeaders);
      }

      // Audit log
      await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: adminId,
        action: "impersonation_start",
        target_user_id: targetUserId,
        details: {
          target_email: targetProfile.email,
          target_name: `${targetProfile.first_name || ""} ${targetProfile.last_name || ""}`.trim(),
        },
      });

      return jsonResponse({
        success: true,
        token: tokenStr,
        targetName: `${targetProfile.first_name || ""} ${targetProfile.last_name || ""}`.trim() || targetProfile.email,
      }, 200, corsHeaders);
    }

    // ─── ACTION: exchange ───
    if (action === "exchange") {
      if (!impersonationToken) {
        return jsonResponse({ error: "token required" }, 400, corsHeaders);
      }

      // Hash the incoming token and look up by hash
      const incomingHash = await sha256Hex(impersonationToken);
      const { data: tokenRecord, error: tokenLookupError } = await supabaseAdmin
        .from("impersonation_tokens")
        .select("*")
        .eq("token_hash", incomingHash)
        .eq("used", false)
        .maybeSingle();

      if (!tokenRecord) {
        const { data: existingRecord } = await supabaseAdmin
          .from("impersonation_tokens")
          .select("used, expires_at")
          .eq("token_hash", incomingHash)
          .maybeSingle();

        if (existingRecord?.used) {
          console.error("exchange: token already used");
          return jsonResponse({ error: "Token already used" }, 401, corsHeaders);
        }
        if (existingRecord && new Date(existingRecord.expires_at) < new Date()) {
          console.error("exchange: token expired");
          return jsonResponse({ error: "Token expired" }, 401, corsHeaders);
        }
        console.error("exchange: token not found", tokenLookupError);
        return jsonResponse({ error: "Invalid or expired token" }, 401, corsHeaders);
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        console.error("exchange: token expired (unused)");
        return jsonResponse({ error: "Token expired" }, 401, corsHeaders);
      }

      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(tokenRecord.target_user_id);
      if (!targetUser?.user?.email) {
        return jsonResponse({ error: "Target user not found in auth" }, 404, corsHeaders);
      }

      const sessionResult = await createSessionForEmail(
        supabaseUrl,
        supabaseAnonKey,
        supabaseAdmin,
        targetUser.user.email,
      );

      if (!sessionResult.session) {
        return jsonResponse(
          { error: sessionResult.error || "Failed to create session" },
          500,
          corsHeaders,
        );
      }

      // Mark token as used only after session is created (failed attempts stay retryable)
      await supabaseAdmin
        .from("impersonation_tokens")
        .update({ used: true })
        .eq("id", tokenRecord.id);

      // Get target roles
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", tokenRecord.target_user_id);

      // Log in user_activity_logs (non-blocking)
      try {
        await supabaseAdmin.from("user_activity_logs").insert({
          user_id: tokenRecord.target_user_id,
          action: "impersonated",
          metadata: {
            impersonated_by: tokenRecord.admin_id,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (logErr) {
        console.error("user_activity_logs insert failed:", logErr);
      }

      return jsonResponse({
        success: true,
        session: {
          access_token: sessionResult.session.access_token,
          refresh_token: sessionResult.session.refresh_token,
        },
        admin_id: tokenRecord.admin_id,
        target: {
          id: tokenRecord.target_user_id,
          email: targetUser.user.email,
          roles: targetRoles?.map((r: any) => r.role) || [],
        },
      }, 200, corsHeaders);
    }

    // ─── ACTION: restore ───
    if (action === "restore") {
      if (!adminAccessToken || !adminRefreshToken) {
        return jsonResponse({ error: "Admin tokens required" }, 400, corsHeaders);
      }

      // Verify the admin tokens are still valid
      const supabaseAdminAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${adminAccessToken}` } },
      });
      const { data: { user: adminUser }, error: adminAuthError } = await supabaseAdminAuth.auth.getUser();

      if (adminAuthError || !adminUser) {
        // Try refreshing the token
        const { data: refreshData, error: refreshError } = await supabaseAdminAuth.auth.refreshSession({
          refresh_token: adminRefreshToken,
        });

        if (refreshError || !refreshData?.session) {
          return jsonResponse({ error: "Admin session expired. Please log in again." }, 401, corsHeaders);
        }

        // Log end of impersonation
        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: refreshData.session.user.id,
          action: "impersonation_end",
          target_user_id: "restored",
          details: {},
        });

        return jsonResponse({
          success: true,
          session: {
            access_token: refreshData.session.access_token,
            refresh_token: refreshData.session.refresh_token,
          },
        }, 200, corsHeaders);
      }

      // Log end of impersonation
      await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: adminUser.id,
        action: "impersonation_end",
        target_user_id: "restored",
        details: {},
      });

      return jsonResponse({
        success: true,
        session: {
          access_token: adminAccessToken,
          refresh_token: adminRefreshToken,
        },
      }, 200, corsHeaders);
    }

    return jsonResponse({ error: "Invalid action" }, 400, corsHeaders);
  } catch (e) {
    console.error("impersonate-user error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
      corsHeaders,
    );
  }
});
