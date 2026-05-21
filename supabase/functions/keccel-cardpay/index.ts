// Keccel CardPay — Intégration officielle confirmée par l'équipe Keccel.
//
// RÈGLES IMMUABLES (cf. SAFETY_POLICY.md §7 et mem://features/keccel-cardpay-constraints) :
// 1. merchantcode = valeur fournie par Keccel (secret KECCEL_CARD_MERCHANT_CODE).
// 2. TOUTES les clés en MINUSCULES (jamais de camelCase).
// 3. Exactement 7 champs : merchantcode, reference, amount, currency, description,
//    callbackurl, returnurl. Ne JAMAIS ajouter language, customerEmail, etc.
// 4. amount en STRING entière (Math.ceil), reference ≤ 25 chars.
// 5. Authorization: "Bearer <token>" (token brut côté secret).
// 6. Endpoint : POST https://api.keccel.net/cardpay
// Toute modification du payload requiert une confirmation écrite de Keccel.
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
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  function errorResponse(error: string, details?: any) {
    return new Response(
      JSON.stringify({ success: false, error, ...(details ? { details } : {}) }),
      { status: 200, headers: jsonHeaders }
    );
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteBaseUrl = Deno.env.get("SITE_BASE_URL");
    const keccelToken = Deno.env.get("KELPAY_TOKEN");
    const keccelMerchantCode = Deno.env.get("KECCEL_CARD_MERCHANT_CODE");

    if (!siteBaseUrl) {
      console.error("SITE_BASE_URL is not configured");
      return errorResponse("Configuration serveur incomplète (SITE_BASE_URL)");
    }
    if (!keccelMerchantCode) {
      console.error("KECCEL_CARD_MERCHANT_CODE is not configured");
      return errorResponse("Configuration carte incomplète : merchant code manquant. Contactez le support.");
    }
    if (!keccelToken) {
      console.error("KELPAY_TOKEN is not configured");
      return errorResponse("Configuration carte incomplète : token manquant. Contactez le support.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Non autorisé");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return errorResponse("Non autorisé");

    // Rate limit 5/min
    const { data: rlAllowed } = await supabase.rpc("check_rate_limit", {
      p_identifier: user.id,
      p_endpoint: "keccel-cardpay",
      p_max_requests: 5,
      p_window_seconds: 60,
    });
    if (rlAllowed === false) return errorResponse("Trop de requêtes. Veuillez patienter.");

    const body = await req.json();
    const { order_id, payment_method, payment_type } = body;
    if (!order_id) return errorResponse("order_id requis");
    const method = payment_method || "card";

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_ref, user_id, total, subtotal, shipping_cost, status, last_mile_fee")
      .eq("id", order_id)
      .maybeSingle();
    if (orderError || !order) return errorResponse("Commande introuvable");
    if (order.user_id !== user.id) return errorResponse("Cette commande ne vous appartient pas");

    // Determine amount
    const pType = payment_type || "order";
    let amount: number;
    if (pType === "shipping") amount = Number(order.shipping_cost) || 0;
    else if (pType === "last_mile") amount = Number(order.last_mile_fee) || 0;
    else amount = Number(order.total) || 0;
    if (amount <= 0) return errorResponse("Montant invalide");

    // Keccel exige amount entier — arrondi sup (perte max 1 cent côté client pour prix .99)
    const amountSent = Math.ceil(amount);

    const diagnosticId = crypto.randomUUID().slice(0, 8);
    // Référence ≤ 25 chars (contrainte Keccel/Visa)
    const reference = `KC${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 23)}`;
    const returnUrl = `${siteBaseUrl}/payment/return?ref=${encodeURIComponent(reference)}&order_id=${order.id}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/kelpay-webhook`;

    // ---- PAYLOAD UNIQUE : 7 champs lowercase, conforme doc Keccel ----
    const payload = {
      merchantcode: keccelMerchantCode,
      reference,
      amount: String(amountSent),
      currency: "USD",
      description: `Commande ${order.order_ref} - Zandofy`,
      callbackurl: callbackUrl,
      returnurl: returnUrl,
    };

    const origin = req.headers.get("Origin") || req.headers.get("Referer") || "";
    const merchantCodeMasked = `${keccelMerchantCode.slice(0, 2)}***${keccelMerchantCode.slice(-2)}`;

    // Pre-flight : aucun champ vide
    const missing = Object.entries(payload)
      .filter(([_, v]) => v === undefined || v === null || v === "")
      .map(([k]) => k);
    if (missing.length > 0) {
      console.error(`[${diagnosticId}] Pre-flight failed:`, missing);
      return errorResponse(
        `Champs manquants avant envoi : ${missing.join(", ")} (diag ${diagnosticId})`,
        { diagnostic_id: diagnosticId, missing }
      );
    }

    // Normaliser le token (au cas où "Bearer xxx" stocké)
    const cleanToken = keccelToken.replace(/^\s*Bearer\s+/i, "").trim();

    console.log(`[${diagnosticId}] Keccel cardpay POST keys=${Object.keys(payload).join(",")} amount=${payload.amount}`);

    let httpStatus = 0;
    let rawBody = "";
    let parsed: any = null;
    let networkError: string | null = null;

    try {
      const resp = await fetch("https://api.keccel.net/cardpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${cleanToken}`,
        },
        body: JSON.stringify(payload),
      });
      httpStatus = resp.status;
      rawBody = await resp.text();
      console.log(`[${diagnosticId}] Keccel ← ${resp.status} ${rawBody.slice(0, 500)}`);
      try { parsed = JSON.parse(rawBody); } catch { parsed = null; }
    } catch (e) {
      networkError = (e as any)?.message ?? String(e);
      console.error(`[${diagnosticId}] Keccel network error:`, e);
    }

    const keccelOk = parsed && String(parsed.code) === "0";
    // Extraction tolérante : on ne change pas le payload envoyé, mais on scanne
    // récursivement TOUTE la réponse Keccel pour trouver l'URL de paiement
    // (typiquement une session Mastercard ap-gateway). On exclut explicitement
    // nos propres callback/return URLs pour ne jamais les confondre avec
    // l'URL de paiement.
    function extractRedirect(p: any, ownUrls: string[]): string | null {
      if (!p) return null;
      const found: string[] = [];
      const preferredKeys = new Set([
        "checkoutUrl", "checkout_url",
        "paymentUrl", "payment_url",
        "redirectUrl", "redirect_url",
        "paymentLink", "payment_link",
        "url", "link", "href", "checkout",
      ]);
      const preferred: string[] = [];
      function walk(node: any, parentKey?: string) {
        if (!node) return;
        if (typeof node === "string") {
          if (/^https?:\/\//i.test(node) && !ownUrls.includes(node)) {
            found.push(node);
            if (parentKey && preferredKeys.has(parentKey)) preferred.push(node);
          }
          return;
        }
        if (Array.isArray(node)) {
          for (const item of node) walk(item, parentKey);
          return;
        }
        if (typeof node === "object") {
          for (const [k, v] of Object.entries(node)) walk(v, k);
        }
      }
      walk(p);
      // Priorité absolue : session Mastercard ap-gateway
      const mastercard = [...preferred, ...found].find(u =>
        /ap-gateway\.mastercard\.com\/checkout\/pay\/SESSION/i.test(u)
      );
      if (mastercard) return mastercard;
      // Sinon : clé préférée
      if (preferred.length > 0) return preferred[0];
      // Sinon : première URL trouvée qui n'est pas une de nos propres URLs
      return found[0] ?? null;
    }
    const redirectUrl: string | null = keccelOk
      ? extractRedirect(parsed, [callbackUrl, returnUrl])
      : null;
    // Contrat strict : carte = redirection obligatoire. Pas d'URL => échec.
    const success = Boolean(keccelOk && redirectUrl);

    // Diagnostic (best-effort, jamais bloquant)
    try {
      await supabase.from("keccel_cardpay_diagnostics").insert({
        diagnostic_id: diagnosticId,
        function_name: "keccel-cardpay",
        environment: supabaseUrl,
        origin,
        site_base_url: siteBaseUrl,
        user_id: user.id,
        order_id: order.id,
        reference,
        amount,
        amount_sent: amountSent,
        currency: "USD",
        callback_url: callbackUrl,
        return_url: returnUrl,
        merchant_code_masked: merchantCodeMasked,
        token_present: true,
        token_length: cleanToken.length,
        sent_keys: Object.keys(payload),
        http_status: httpStatus,
        raw_body: rawBody.slice(0, 4000),
        keccel_code: String(parsed?.code ?? ""),
        keccel_description: parsed?.description ?? null,
        keccel_response: parsed,
        error: networkError ? `network_error: ${networkError}` : (success ? null : "keccel_error"),
      });
    } catch (e) {
      console.error(`[${diagnosticId}] Diagnostic insert failed:`, e);
    }

    if (!success) {
      // Marquer la commande payment_failed côté serveur pour cohérence admin.
      if (pType === "order") {
        await supabase
          .from("orders")
          .update({ status: "payment_failed" })
          .eq("id", order.id)
          .in("status", ["pending", "awaiting_payment"]);
      }
      const reason = !keccelOk
        ? `Keccel a refusé le paiement (code ${parsed?.code ?? "?"})`
        : "Keccel n'a pas renvoyé d'URL de paiement exploitable";
      return errorResponse(
        `${reason} (diag ${diagnosticId}). HTTP ${httpStatus} — ${parsed?.description ?? "réponse vide"}.`,
        {
          diagnostic_id: diagnosticId,
          httpStatus,
          keccel_description: parsed?.description ?? null,
          keccel_ok: keccelOk,
          redirect_url_present: Boolean(redirectUrl),
          response_keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
          body: rawBody.slice(0, 500),
        }
      );
    }

    // Create payment transaction
    const { data: tx, error: txError } = await supabase
      .from("payment_transactions")
      .insert({
        order_id: order.id,
        user_id: user.id,
        method: method === "paypal" ? "paypal" : "card",
        provider: "keccel",
        amount,
        currency: "USD",
        reference: reference.substring(0, 255),
        transaction_id: parsed?.transactionid || null,
        status: "pending",
        payment_type: pType,
        callback_payload: parsed,
      })
      .select("id")
      .single();

    if (txError) {
      console.error("Error creating payment transaction:", txError);
      return errorResponse("Erreur interne lors de la création de la transaction");
    }

    if (pType === "order") {
      await supabase
        .from("orders")
        .update({ status: "awaiting_payment", payment_method: method === "paypal" ? "paypal" : "card" })
        .eq("id", order.id)
        .in("status", ["pending", "awaiting_payment"]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: tx?.id,
        redirect_url: redirectUrl,
        reference,
        status: "pending",
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    console.error("keccel-cardpay error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur serveur" }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
