// generate-shipping-labels v2 — enhanced diagnostic logs (forces redeploy)
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
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[1],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // CORS preflight — ALWAYS first, never blocked by auth
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, success: false, error: "Unauthorized", errorCode: "NO_AUTH" }), {
        status: 200,
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
      console.log("[v2] auth failed:", claimsError?.message);
      return new Response(JSON.stringify({ ok: false, success: false, error: "Unauthorized", errorCode: "INVALID_TOKEN" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const orderIds: string[] = body?.orderIds;
    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 50) {
      return new Response(
        JSON.stringify({ ok: false, success: false, error: "orderIds doit être un tableau de 1 à 50 éléments", errorCode: "BAD_INPUT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderIds.every((id) => uuidRegex.test(id))) {
      return new Response(
        JSON.stringify({ ok: false, success: false, error: "Format d'ID invalide", errorCode: "BAD_UUID" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    console.log("[v2] userId=", userId, "roles=", userRoles, "orderIds reçus=", orderIds);

    if (!isStaff && !isVendor) {
      console.log("[v2] access denied: no staff/vendor role");
      return new Response(JSON.stringify({ ok: false, success: false, error: "Accès refusé" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch orders (added shipping_email, shipping_mode)
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_ref, shipping_first_name, shipping_last_name, shipping_phone, shipping_email, shipping_address, shipping_city, shipping_country, total, shipping_cost, tracking_number, delivery_choice, store_id, status, shipping_mode"
      )
      .in("id", orderIds);

    console.log("[v2] orders.length après select=", orders?.length ?? 0, "ordersError=", ordersError?.message);

    if (ordersError || !orders || orders.length === 0) {
      const foundIds = (orders || []).map((o: any) => o.id);
      const missing = orderIds.filter((id) => !foundIds.includes(id));
      console.log("[v2] missing orderIds=", missing);
      return new Response(
        JSON.stringify({
          ok: false,
          success: false,
          error: "Aucune commande trouvée",
          errorCode: "ORDERS_NOT_FOUND",
          missingIds: missing,
          dbError: ordersError?.message || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For vendors: verify they own the store + labels enabled
    if (!isStaff) {
      const storeIds = [...new Set(orders.map((o: any) => o.store_id).filter(Boolean))];
      console.log("[v2] vendor flow store_ids=", storeIds);

      for (const sid of storeIds) {
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("owner_id")
          .eq("id", sid)
          .single();

        const isOwner = store?.owner_id === userId;
        let isCollab = false;

        if (!isOwner) {
          const { data: collab } = await supabaseAdmin
            .from("store_collaborators")
            .select("id")
            .eq("store_id", sid)
            .eq("user_id", userId)
            .eq("status", "active")
            .limit(1);

          isCollab = !!(collab && collab.length > 0);
          console.log("[v2] store=", sid, "isOwner=", isOwner, "isCollab=", isCollab);

          if (!isCollab) {
            return new Response(
              JSON.stringify({ ok: false, success: false, error: "Accès refusé à cette boutique", errorCode: "STORE_ACCESS_DENIED" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          console.log("[v2] store=", sid, "isOwner=true");
        }

        const { data: pricing } = await supabaseAdmin
          .from("vendor_pricing_overrides")
          .select("shipping_labels_enabled")
          .eq("store_id", sid)
          .single();

        if (!pricing?.shipping_labels_enabled) {
          console.log("[v2] labels not enabled for store=", sid);
          return new Response(
            JSON.stringify({ ok: false, success: false, error: "Étiquettes d'expédition non activées pour cette boutique", errorCode: "LABELS_NOT_ENABLED" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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
        totalWeightKg: Math.round(totalWeightG / 10) / 100, // grams -> kg with 2 decimals
        totalVolumeCBM: Math.round(totalCBM * 10000) / 10000, // 4 decimals
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

    console.log("[v2] success: returning", labels.length, "labels");
    return new Response(JSON.stringify({ ok: true, success: true, labels }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[v2] uncaught error:", e);
    return new Response(
      JSON.stringify({ ok: false, success: false, error: e instanceof Error ? e.message : "Erreur interne", errorCode: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
