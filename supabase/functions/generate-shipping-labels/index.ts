import { createClient } from "npm:@supabase/supabase-js@2";

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
  const respond = (ok: boolean, payload: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ ok, success: ok, ...payload }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond(false, { error: "Unauthorized", errorCode: "AUTH_MISSING" });
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return respond(false, { error: "Unauthorized", errorCode: "AUTH_INVALID" });
    }
    const userId = user.id;

    const body = await req.json();
    const orderIds: string[] = body?.orderIds;
    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 50) {
      return respond(false, { error: "orderIds doit être un tableau de 1 à 50 éléments", errorCode: "INVALID_INPUT" });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderIds.every((id) => uuidRegex.test(id))) {
      return respond(false, { error: "Format d'ID invalide", errorCode: "INVALID_UUID" });
    }

    console.log("[shipping-labels] userId:", userId, "orderIds:", orderIds);

    // Check roles
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isStaff = userRoles.includes("admin") || userRoles.includes("manager");
    const isVendor = userRoles.includes("vendor");

    console.log("[shipping-labels] roles:", userRoles, "isStaff:", isStaff, "isVendor:", isVendor);

    if (!isStaff && !isVendor) {
      return respond(false, { error: "Accès refusé", errorCode: "FORBIDDEN_ROLE" });
    }

    // Fetch orders (added shipping_email, shipping_mode)
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_ref, shipping_first_name, shipping_last_name, shipping_phone, shipping_email, shipping_address, shipping_city, shipping_country, total, shipping_cost, tracking_number, delivery_choice, store_id, status, shipping_mode"
      )
      .in("id", orderIds);

    console.log("[shipping-labels] orders found:", orders?.length || 0, "error:", ordersError?.message);

    if (ordersError) {
      return respond(false, { error: "Erreur DB: " + ordersError.message, errorCode: "DB_ERROR" });
    }
    if (!orders || orders.length === 0) {
      return respond(false, { error: "Aucune commande trouvée pour les IDs fournis", errorCode: "NO_ORDERS" });
    }

    // For vendors: verify they own the store + labels enabled
    if (!isStaff) {
      const storeIds = [...new Set(orders.map((o: any) => o.store_id).filter(Boolean))];
      console.log("[shipping-labels] vendor check storeIds:", storeIds);

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
            console.log("[shipping-labels] denied: not owner/collab for store", sid);
            return respond(false, { error: "Accès refusé à cette boutique", errorCode: "FORBIDDEN_STORE" });
          }
        }

        const { data: pricing } = await supabaseAdmin
          .from("vendor_pricing_overrides")
          .select("shipping_labels_enabled")
          .eq("store_id", sid)
          .single();

        if (!pricing?.shipping_labels_enabled) {
          console.log("[shipping-labels] labels not enabled for store", sid);
          return respond(false, { error: "Étiquettes d'expédition non activées pour cette boutique. Contactez l'administrateur pour activer cette fonctionnalité.", errorCode: "LABELS_DISABLED" });
        }
      }
    }

    // Fetch order items with product physical attributes
    const { data: orderItems } = await supabaseAdmin
      .from("order_items")
      .select("order_id, quantity, product_id")
      .in("order_id", orderIds);

    const itemCountMap: Record<string, number> = {};
    const orderProductIds: Record<string, { product_id: string; quantity: number }[]> = {};
    (orderItems || []).forEach((i: any) => {
      itemCountMap[i.order_id] = (itemCountMap[i.order_id] || 0) + (i.quantity || 1);
      if (i.product_id) {
        if (!orderProductIds[i.order_id]) orderProductIds[i.order_id] = [];
        orderProductIds[i.order_id].push({ product_id: i.product_id, quantity: i.quantity || 1 });
      }
    });

    // Fetch products with physical attributes + origin_country
    const allProductIds = [...new Set(Object.values(orderProductIds).flat().map(x => x.product_id))];
    const productMap: Record<string, any> = {};
    if (allProductIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from("products")
        .select("id, origin_country, weight_grams, length_cm, width_cm, height_cm")
        .in("id", allProductIds);
      (products || []).forEach((p: any) => {
        productMap[p.id] = p;
      });
    }

    // Compute origin, weight, CBM, estimated dimensions per order
    const orderOriginMap: Record<string, string> = {};
    const orderMetrics: Record<string, { totalWeightKg: number; totalVolumeCBM: number; estimatedDimensions: string }> = {};
    for (const [orderId, items] of Object.entries(orderProductIds)) {
      let totalWeightG = 0;
      let totalCBM = 0;
      let maxL = 0, maxW = 0, sumH = 0;
      let originSet = false;
      for (const item of items) {
        const p = productMap[item.product_id];
        if (!p) continue;
        if (!originSet && p.origin_country) {
          orderOriginMap[orderId] = p.origin_country;
          originSet = true;
        }
        const qty = item.quantity;
        totalWeightG += (p.weight_grams || 0) * qty;
        const l = p.length_cm || 0, w = p.width_cm || 0, h = p.height_cm || 0;
        if (l > 0 && w > 0 && h > 0) {
          totalCBM += (l * w * h / 1000000) * qty;
          if (l > maxL) maxL = l;
          if (w > maxW) maxW = w;
          sumH += h * qty;
        }
      }
      orderMetrics[orderId] = {
        totalWeightKg: Math.round(totalWeightG / 10) / 100,
        totalVolumeCBM: Math.round(totalCBM * 10000) / 10000,
        estimatedDimensions: maxL > 0 ? `${maxL}×${maxW}×${sumH} cm` : "",
      };
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
      const metrics = orderMetrics[o.id] || { totalWeightKg: 0, totalVolumeCBM: 0, estimatedDimensions: "" };
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
        shippingMode: o.shipping_mode || "",
        totalWeightKg: metrics.totalWeightKg,
        totalVolumeCBM: metrics.totalVolumeCBM,
        estimatedDimensions: metrics.estimatedDimensions,
      };
    });

    console.log("[shipping-labels] returning", labels.length, "labels");
    return respond(true, { labels });
  } catch (e) {
    console.error("[shipping-labels] uncaught:", e);
    return new Response(
      JSON.stringify({ ok: false, success: false, error: e instanceof Error ? e.message : "Erreur interne", errorCode: "INTERNAL" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
