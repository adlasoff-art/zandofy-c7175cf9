// Keccel CardPay — reference capped at 25 chars for Visa compatibility
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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Non autorisé");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return errorResponse("Non autorisé");
    }

    // Rate limiting: 5 requests/min per user
    const { data: rlAllowed } = await supabase.rpc("check_rate_limit", {
      p_identifier: user.id,
      p_endpoint: "keccel-cardpay",
      p_max_requests: 5,
      p_window_seconds: 60,
    });
    if (rlAllowed === false) {
      return errorResponse("Trop de requêtes. Veuillez patienter.");
    }

    const body = await req.json();
    const { order_id, payment_method, payment_type, save_card } = body;

    if (!order_id) {
      return errorResponse("order_id requis");
    }

    const method = payment_method || "card";

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_ref, user_id, total, subtotal, shipping_cost, status, last_mile_fee")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      return errorResponse("Commande introuvable");
    }

    if (order.user_id !== user.id) {
      return errorResponse("Cette commande ne vous appartient pas");
    }

    // Determine amount based on payment_type
    const pType = payment_type || "order";
    let amount: number;
    if (pType === "shipping") {
      amount = Number(order.shipping_cost) || 0;
    } else if (pType === "last_mile") {
      amount = Number(order.last_mile_fee) || 0;
    } else {
      amount = Number(order.total) || 0;
    }

    if (amount <= 0) {
      return errorResponse("Montant invalide");
    }

    // Keccel CardPay attend un montant ENTIER. Tous nos prix se terminent en .99 (prix
    // stratégique), donc on arrondit à l'entier supérieur : perte max 1 centime côté client.
    const amountSent = Math.ceil(amount);

    // Diagnostic id (short, returned to client to correlate with logs)
    const diagnosticId = crypto.randomUUID().slice(0, 8);

    // Max 25 chars for Keccel compatibility
    const reference = `KC${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 23)}`;
    const returnUrl = `${siteBaseUrl}/payment/return?ref=${encodeURIComponent(reference)}&order_id=${order.id}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/kelpay-webhook`;

    // Base payload (sans la clé returnUrl/returnurl, ajoutée par variante)
    const basePayload = {
      merchantcode: keccelMerchantCode,
      reference: reference,
      // Keccel exige `amount` en STRING (cf. doc Kelpay_API_Card page 2, exemple "amount":"100").
      amount: String(amountSent),
      currency: "USD",
      description: `Commande ${order.order_ref} - Zandofy`,
      callbackurl: callbackUrl,
    };
    // Payload par défaut (clé `returnUrl` camelCase) pour les diagnostics et pre-flight
    const keccelPayload: Record<string, unknown> = { ...basePayload, returnUrl: returnUrl };

    const origin = req.headers.get("Origin") || req.headers.get("Referer") || "";
    const merchantCodeMasked = keccelMerchantCode
      ? `${keccelMerchantCode.slice(0, 2)}***${keccelMerchantCode.slice(-2)}`
      : null;
    let diagnosticPersisted = false;
    let lastDiagnosticInsertError: Record<string, unknown> | null = null;

    // Helper: persist a diagnostic row (best-effort, never throws)
    async function persistDiagnostic(extra: Record<string, unknown>): Promise<boolean> {
      try {
        const { error: diagInsertError } = await supabase.from("keccel_cardpay_diagnostics").insert({
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
          token_present: Boolean(keccelToken),
          token_length: keccelToken?.length ?? null,
          sent_keys: Object.keys(keccelPayload),
          ...extra,
        });
        if (diagInsertError) {
          lastDiagnosticInsertError = {
            code: (diagInsertError as any)?.code,
            message: (diagInsertError as any)?.message,
            details: (diagInsertError as any)?.details,
            hint: (diagInsertError as any)?.hint,
          };
          console.error(
            `[${diagnosticId}] Diagnostic insert FAILED on table keccel_cardpay_diagnostics:`,
            JSON.stringify(lastDiagnosticInsertError)
          );
          return false;
        }
        diagnosticPersisted = true;
        return true;
      } catch (e) {
        lastDiagnosticInsertError = { message: (e as any)?.message ?? String(e) };
        console.error(`[${diagnosticId}] Failed to persist diagnostic:`, e);
        return false;
      }
    }

    // ---- Local pre-flight validation (before hitting Keccel) ----
    const required: Record<string, unknown> = {
      merchantcode: basePayload.merchantcode,
      reference: basePayload.reference,
      amount: basePayload.amount,
      currency: basePayload.currency,
      description: basePayload.description,
      callbackurl: basePayload.callbackurl,
      returnUrl: returnUrl,
    };
    const missingLocal: string[] = [];
    for (const [k, v] of Object.entries(required)) {
      if (v === undefined || v === null || v === "" || (typeof v === "number" && !Number.isFinite(v))) {
        missingLocal.push(k);
      }
    }
    if (missingLocal.length > 0) {
      console.error(`[${diagnosticId}] Pre-flight failed, missing:`, missingLocal);
      await persistDiagnostic({ pre_flight_missing: missingLocal, error: "pre_flight_missing" });
      return errorResponse(
        `Champs manquants avant envoi : ${missingLocal.join(", ")} (diag ${diagnosticId})`,
        { diagnostic_id: diagnosticId, missing: missingLocal }
      );
    }

    // ---- Diagnostic snapshot (safe: no secret values) ----
    const fieldShape = Object.fromEntries(
      Object.entries(keccelPayload).map(([k, v]) => [
        k,
        {
          type: typeof v,
          length: typeof v === "string" ? v.length : undefined,
          present: v !== undefined && v !== null && v !== "",
          // sample only for non-secret URL/ref fields
          sample: ["reference", "currency", "callbackurl", "returnUrl"].includes(k)
            ? String(v).slice(0, 80)
            : undefined,
        },
      ])
    );
    console.log(`[${diagnosticId}] Keccel cardpay payload shape:`, JSON.stringify(fieldShape));
    console.log(`[${diagnosticId}] Keccel cardpay payload keys:`, Object.keys(keccelPayload).join(","));
    console.log(`[${diagnosticId}] Keccel token present:`, Boolean(keccelToken), "len:", keccelToken?.length);

    // Normaliser le token : si l'admin a stocké "Bearer xxx" dans le secret,
    // on enlève le préfixe pour éviter "Bearer Bearer xxx".
    const cleanToken = keccelToken.replace(/^\s*Bearer\s+/i, "").trim();

    type Attempt = {
      attempt_index: number;
      auth_format: "bearer_normalized" | "raw_token";
      return_key_mode: "returnUrl" | "returnurl" | "both";
    };
    const attempts: Attempt[] = [
      { attempt_index: 1, auth_format: "bearer_normalized", return_key_mode: "returnUrl" },
      { attempt_index: 2, auth_format: "raw_token",         return_key_mode: "returnUrl" },
      { attempt_index: 3, auth_format: "bearer_normalized", return_key_mode: "returnurl" },
      { attempt_index: 4, auth_format: "bearer_normalized", return_key_mode: "both" },
    ];

    let keccelResponse: any = null;
    let redirectUrl: string | null = null;
    let lastHttpStatus = 0;
    let lastRawBody = "";
    let success = false;

    for (const att of attempts) {
      const payload: Record<string, unknown> = { ...basePayload };
      if (att.return_key_mode === "returnUrl" || att.return_key_mode === "both") {
        payload.returnUrl = returnUrl;
      }
      if (att.return_key_mode === "returnurl" || att.return_key_mode === "both") {
        payload.returnurl = returnUrl;
      }
      const authValue = att.auth_format === "bearer_normalized"
        ? `Bearer ${cleanToken}`
        : cleanToken;

      console.log(`[${diagnosticId}] attempt ${att.attempt_index} auth=${att.auth_format} returnKey=${att.return_key_mode} keys=${Object.keys(payload).join(",")}`);

      try {
        const resp = await fetch("https://api.keccel.net/cardpay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": authValue,
          },
          body: JSON.stringify(payload),
        });
        lastHttpStatus = resp.status;
        const rawBody = await resp.text();
        lastRawBody = rawBody;
        console.log(`[${diagnosticId}] attempt ${att.attempt_index} ← status ${resp.status} body ${rawBody.slice(0, 500)}`);

        let parsed: any = null;
        try { parsed = JSON.parse(rawBody); } catch { parsed = null; }

        const attemptShape = Object.fromEntries(
          Object.entries(payload).map(([k, v]) => [k, {
            type: typeof v,
            length: typeof v === "string" ? (v as string).length : undefined,
            present: v !== undefined && v !== null && v !== "",
          }])
        );

        await persistDiagnostic({
          payload_shape: attemptShape,
          http_status: resp.status,
          raw_body: rawBody.slice(0, 4000),
          keccel_code: String(parsed?.code ?? ""),
          keccel_description: parsed?.description ?? null,
          keccel_response: {
            attempt_index: att.attempt_index,
            auth_format: att.auth_format,
            return_key_mode: att.return_key_mode,
            sent_keys: Object.keys(payload),
            response: parsed,
          },
          error: parsed && String(parsed?.code) === "0" ? null : "keccel_error",
        });

        if (parsed && String(parsed.code) === "0") {
          keccelResponse = parsed;
          redirectUrl = parsed?.checkoutUrl || null;
          success = true;
          break;
        }
      } catch (apiError) {
        console.error(`[${diagnosticId}] attempt ${att.attempt_index} network error:`, apiError);
        await persistDiagnostic({
          payload_shape: fieldShape,
          keccel_response: {
            attempt_index: att.attempt_index,
            auth_format: att.auth_format,
            return_key_mode: att.return_key_mode,
          },
          error: `network_error: ${(apiError as any)?.message ?? String(apiError)}`,
        });
      }
    }

    if (!success) {
      return errorResponse(
        `Keccel a refusé les ${attempts.length} variantes d'appel (diag ${diagnosticId}). Dernière réponse HTTP ${lastHttpStatus}.`,
        {
          diagnostic_id: diagnosticId,
          httpStatus: lastHttpStatus,
          body: lastRawBody.slice(0, 500),
          diagnostic_persisted: diagnosticPersisted,
          diagnostic_insert_error: lastDiagnosticInsertError,
          environment: supabaseUrl,
          site_base_url: siteBaseUrl,
        }
      );
    }

    // Create payment transaction record
    const { data: tx, error: txError } = await supabase
      .from("payment_transactions")
      .insert({
        order_id: order.id,
        user_id: user.id,
        method: method === "paypal" ? "paypal" : "card",
        provider: "keccel",
        amount: amount,
        currency: "USD",
        reference: reference.substring(0, 255),
        transaction_id: keccelResponse?.transactionid || null,
        status: "pending",
        payment_type: pType,
        callback_payload: keccelResponse,
      })
      .select("id")
      .single();

    if (txError) {
      console.error("Error creating payment transaction:", txError);
      return errorResponse("Erreur interne lors de la création de la transaction");
    }

    // Update order status to awaiting_payment if it's the main order payment
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
        reference: reference,
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
