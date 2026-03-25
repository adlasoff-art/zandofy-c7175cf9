import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify admin identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminId = authUser.id;

    // Check admin role using service role client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId);

    const isAdmin = adminRoles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, targetUserId } = await req.json();

    if (action === "start_impersonation") {
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "targetUserId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch target user profile
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name")
        .eq("id", targetUserId)
        .single();

      if (!targetProfile) {
        return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch target user roles
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);

      // Fetch recent orders (last 20)
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id, order_ref, status, total, subtotal, created_at, shipping_city, payment_method")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Compute stats
      const allOrders = orders || [];
      const totalOrders = allOrders.length;
      const totalSpent = allOrders
        .filter((o: any) => !["cancelled", "returned", "payment_failed", "awaiting_payment"].includes(o.status))
        .reduce((s: number, o: any) => s + Number(o.subtotal || 0), 0);
      const totalDelivered = allOrders.filter((o: any) => o.status === "delivered").length;

      // Fetch addresses
      const { data: addresses } = await supabaseAdmin
        .from("saved_addresses")
        .select("id, label, address, city, country, is_default")
        .eq("user_id", targetUserId);

      // Fetch vendor wallet if vendor
      const isVendor = targetRoles?.some((r: any) => r.role === "vendor");
      let wallet = null;
      if (isVendor) {
        const { data: stores } = await supabaseAdmin
          .from("stores")
          .select("id")
          .eq("owner_id", targetUserId)
          .limit(1);
        if (stores && stores.length > 0) {
          const { data: w } = await supabaseAdmin
            .from("vendor_wallets")
            .select("available_balance, pending_balance, total_earned")
            .eq("store_id", stores[0].id)
            .maybeSingle();
          wallet = w;
        }
      }

      // Fetch payment methods
      const { data: paymentMethods } = await supabaseAdmin
        .from("payment_methods")
        .select("id, provider, phone_number, is_default, label")
        .eq("user_id", targetUserId);

      // Log impersonation in audit
      await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: adminId,
        action: "impersonation_start",
        target_user_id: targetUserId,
        details: {
          target_email: targetProfile.email,
          target_name: `${targetProfile.first_name || ""} ${targetProfile.last_name || ""}`.trim(),
        },
      });

      // Log in user_activity_logs
      await supabaseAdmin.from("user_activity_logs").insert({
        user_id: targetUserId,
        action: "impersonated",
        metadata: {
          impersonated_by: adminId,
          timestamp: new Date().toISOString(),
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          target: {
            id: targetProfile.id,
            email: targetProfile.email,
            first_name: targetProfile.first_name,
            last_name: targetProfile.last_name,
            roles: targetRoles?.map((r: any) => r.role) || [],
          },
          orders: allOrders,
          stats: {
            total_orders: totalOrders,
            total_spent: Math.round(totalSpent * 100) / 100,
            total_delivered: totalDelivered,
          },
          addresses: addresses || [],
          wallet,
          payment_methods: paymentMethods || [],
          impersonated_by: adminId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "end_impersonation") {
      await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: adminId,
        action: "impersonation_end",
        target_user_id: targetUserId || "unknown",
        details: {},
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("impersonate-user error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
