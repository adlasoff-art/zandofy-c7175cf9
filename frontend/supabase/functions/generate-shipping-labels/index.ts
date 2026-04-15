import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const orderIds: string[] = body?.orderIds;
    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 50) {
      return new Response(
        JSON.stringify({ error: "orderIds doit être un tableau de 1 à 50 éléments" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderIds.every((id) => uuidRegex.test(id))) {
      return new Response(
        JSON.stringify({ error: "Format d'ID invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check roles
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isStaff = userRoles.includes("admin") || userRoles.includes("manager");
    const isVendor = userRoles.includes("vendor");

    if (!isStaff && !isVendor) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch orders (added shipping_email)
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_ref, shipping_first_name, shipping_last_name, shipping_phone, shipping_email, shipping_address, shipping_city, shipping_country, total, shipping_cost, tracking_number, delivery_choice, store_id, status"
      )
      .in("id", orderIds);

    if (ordersError || !orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucune commande trouvée" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For vendors: verify they own the store + labels enabled
    if (!isStaff) {
      const storeIds = [...new Set(orders.map((o: any) => o.store_id).filter(Boolean))];

      for (const sid of storeIds) {
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("owner_id")
          .eq("id", sid)
          .single();

        const isOwner = store?.owner_id === userId;

        if (!isOwner) {
          const { data: collab } = await supabaseAdmin
            .from("store_collaborators")
            .select("id")
            .eq("store_id", sid)
            .eq("user_id", userId)
            .eq("status", "active")
            .limit(1);

          if (!collab || collab.length === 0) {
            return new Response(
              JSON.stringify({ error: "Accès refusé à cette boutique" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const { data: pricing } = await supabaseAdmin
          .from("vendor_pricing_overrides")
          .select("shipping_labels_enabled")
          .eq("store_id", sid)
          .single();

        if (!pricing?.shipping_labels_enabled) {
          return new Response(
            JSON.stringify({ error: "Étiquettes d'expédition non activées pour cette boutique" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fetch order items count + origin_country per order
    const { data: orderItems } = await supabaseAdmin
      .from("order_items")
      .select("order_id, quantity, product_id")
      .in("order_id", orderIds);

    const itemCountMap: Record<string, number> = {};
    const orderProductIds: Record<string, string[]> = {};
    (orderItems || []).forEach((i: any) => {
      itemCountMap[i.order_id] = (itemCountMap[i.order_id] || 0) + (i.quantity || 1);
      if (i.product_id) {
        if (!orderProductIds[i.order_id]) orderProductIds[i.order_id] = [];
        orderProductIds[i.order_id].push(i.product_id);
      }
    });

    // Fetch origin_country from products
    const allProductIds = [...new Set(Object.values(orderProductIds).flat())];
    const originMap: Record<string, string> = {};
    if (allProductIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from("products")
        .select("id, origin_country")
        .in("id", allProductIds);
      (products || []).forEach((p: any) => {
        if (p.origin_country) originMap[p.id] = p.origin_country;
      });
    }

    // Get origin_country per order (first product's origin)
    const orderOriginMap: Record<string, string> = {};
    for (const [orderId, pids] of Object.entries(orderProductIds)) {
      for (const pid of pids) {
        if (originMap[pid]) {
          orderOriginMap[orderId] = originMap[pid];
          break;
        }
      }
    }

    // Fetch store info
    const storeIds = [...new Set(orders.map((o: any) => o.store_id).filter(Boolean))];
    const { data: stores } = await supabaseAdmin
      .from("stores")
      .select("id, name, city, country")
      .in("id", storeIds);

    const storeMap: Record<string, any> = {};
    (stores || []).forEach((s: any) => {
      storeMap[s.id] = s;
    });

    // Fetch carrier logo from platform_settings
    let carrierLogoUrl = "";
    const { data: labelConfig } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "shipping_label_config")
      .single();
    if (labelConfig?.value) {
      const cfg = labelConfig.value as any;
      carrierLogoUrl = cfg.carrier_logo_url || "";
    }

    // Build labels data
    const labels = orders.map((o: any) => {
      const store = storeMap[o.store_id] || {};
      return {
        orderRef: o.order_ref || "—",
        trackingNumber: o.tracking_number || "",
        recipientName: `${o.shipping_first_name || ""} ${o.shipping_last_name || ""}`.trim() || "—",
        recipientPhone: o.shipping_phone || "",
        recipientEmail: o.shipping_email || "",
        recipientAddress: o.shipping_address || "",
        recipientCity: o.shipping_city || "",
        recipientCountry: o.shipping_country || "",
        shippingCost: Number(o.shipping_cost || 0).toFixed(2),
        itemsCount: itemCountMap[o.id] || 0,
        deliveryChoice: o.delivery_choice || "",
        storeName: store.name || "Zandofy",
        storeCity: store.city || "",
        storeCountry: store.country || "",
        originCountry: orderOriginMap[o.id] || "",
        carrierLogoUrl,
      };
    });

    return new Response(JSON.stringify({ success: true, labels }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
