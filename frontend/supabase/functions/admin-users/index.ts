import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Verify caller is admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const callerId = claims.claims.sub as string;

    // Check admin role
    const { data: roleCheck } = await anonClient.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { status: 403, headers: corsHeaders });
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
          return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
        }
        // Send password reset email
        const { error: resetErr } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: userData.user.email,
        });
        if (resetErr) {
          return new Response(JSON.stringify({ error: resetErr.message }), { status: 500, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, email: userData.user.email }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "ban_user": {
        const { reason } = params;
        // Disable auth account
        const { error: banErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "876600h", // ~100 years
        });
        if (banErr) {
          return new Response(JSON.stringify({ error: banErr.message }), { status: 500, headers: corsHeaders });
        }
        // Update profile
        await adminClient.from("profiles").update({
          is_banned: true,
          ban_reason: reason || "Violation des conditions d'utilisation",
          banned_at: new Date().toISOString(),
          banned_by: callerId,
        }).eq("id", userId);

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "unban_user": {
        // Re-enable auth account
        const { error: unbanErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (unbanErr) {
          return new Response(JSON.stringify({ error: unbanErr.message }), { status: 500, headers: corsHeaders });
        }
        // Update profile
        await adminClient.from("profiles").update({
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          banned_by: null,
        }).eq("id", userId);

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get_user_details": {
        // Get auth user details (last sign in, created at, etc.)
        const { data: authUser, error: authErr } = await adminClient.auth.admin.getUserById(userId);
        if (authErr) {
          return new Response(JSON.stringify({ error: authErr.message }), { status: 500, headers: corsHeaders });
        }
        return new Response(JSON.stringify({
          last_sign_in_at: authUser.user.last_sign_in_at,
          created_at: authUser.user.created_at,
          email_confirmed_at: authUser.user.email_confirmed_at,
          banned_until: authUser.user.banned_until,
          providers: authUser.user.app_metadata?.providers || [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
