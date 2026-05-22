import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "nodemailer";
import { sendEmail } from "../_shared/email.ts";

/**
 * Lot 18 — Edge Function run-healthchecks
 * Cron 5min : pings KelPay, Edge Functions critiques, SMTP, vérif heartbeats crons.
 * Crée/ferme automatiquement les incidents et envoie alertes (email + push).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CRITICAL_EDGE_FUNCTIONS = [
  "process-automation",
  "notify-order-status",
  "kelpay-webhook",
  "process-dispute-sla",
  "process-vendor-analytics-emails",
  "send-vendor-email",
  "track-shipment-17track",
];

interface CheckResult {
  component: string;
  component_type: "edge_function" | "payment_gateway" | "smtp" | "cron" | "external_api";
  status: "ok" | "warn" | "down";
  latency_ms?: number;
  http_status?: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

async function checkEdgeFunctionAlive(supabase: any, name: string, threshold: number): Promise<CheckResult> {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const start = Date.now();
  try {
    // OPTIONS preflight ne déclenche pas la logique métier
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: { Origin: "https://zandofy.com" },
      signal: AbortSignal.timeout(10_000),
    });
    const latency = Date.now() - start;
    const ok = res.status >= 200 && res.status < 500;
    return {
      component: `ef:${name}`,
      component_type: "edge_function",
      status: !ok ? "down" : latency > threshold ? "warn" : "ok",
      latency_ms: latency,
      http_status: res.status,
      error_message: !ok ? `HTTP ${res.status}` : undefined,
    };
  } catch (e) {
    return {
      component: `ef:${name}`,
      component_type: "edge_function",
      status: "down",
      latency_ms: Date.now() - start,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

/** DNS + HTTP reachability (aligned with kelpay-payment / keccel-cardpay). */
async function probeGateway(
  component: string,
  url: string,
  threshold: number,
): Promise<CheckResult> {
  const start = Date.now();
  const opts = { signal: AbortSignal.timeout(15_000) };
  try {
    let res = await fetch(url, { method: "HEAD", ...opts });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", ...opts });
    }
    const latency = Date.now() - start;
    // Any HTTP response means the gateway host is reachable (not a DNS/network failure).
    const reachable = res.status > 0 && res.status < 600;
    return {
      component,
      component_type: "payment_gateway",
      status: !reachable ? "down" : latency > threshold ? "warn" : "ok",
      latency_ms: latency,
      http_status: res.status,
      error_message: !reachable ? `HTTP ${res.status}` : undefined,
      metadata: { probe_url: url },
    };
  } catch (e) {
    return {
      component,
      component_type: "payment_gateway",
      status: "down",
      latency_ms: Date.now() - start,
      error_message: e instanceof Error ? e.message : String(e),
      metadata: { probe_url: url },
    };
  }
}

/** KelPay mobile money — same host as kelpay-payment. */
async function checkKelpay(threshold: number): Promise<CheckResult> {
  return probeGateway(
    "gateway:kelpay",
    "https://pay.keccel.com/",
    threshold,
  );
}

/** Keccel card / Mastercard redirect — same host as keccel-cardpay. */
async function checkKeccelCard(threshold: number): Promise<CheckResult> {
  return probeGateway(
    "gateway:keccel-card",
    "https://api.keccel.net/",
    threshold,
  );
}

/** Primary transactional email (Resend HTTP API). */
async function checkResend(): Promise<CheckResult> {
  const start = Date.now();
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return {
      component: "email:resend",
      component_type: "external_api",
      status: "warn",
      error_message: "RESEND_API_KEY not configured",
    };
  }
  try {
    const res = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const latency = Date.now() - start;
    const apiReachable = res.status > 0 && res.status < 600;
    const keyValid = res.ok;
    return {
      component: "email:resend",
      component_type: "external_api",
      status: !apiReachable
        ? "down"
        : !keyValid
        ? "down"
        : latency > 8000
        ? "warn"
        : "ok",
      latency_ms: latency,
      http_status: res.status,
      error_message: !apiReachable
        ? `Resend API HTTP ${res.status}`
        : !keyValid
        ? "Resend API key invalid or unauthorized"
        : undefined,
    };
  } catch (e) {
    return {
      component: "email:resend",
      component_type: "external_api",
      status: "down",
      latency_ms: Date.now() - start,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Legacy Hostinger SMTP — only when SMTP_* secrets are set (notify-order-status, campaigns, etc.). */
async function checkSmtpLegacy(): Promise<CheckResult | null> {
  const start = Date.now();
  const host = Deno.env.get("SMTP_HOST");
  const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!host || !user || !pass) return null;
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
    await transporter.verify();
    return {
      component: "smtp:hostinger",
      component_type: "smtp",
      status: "ok",
      latency_ms: Date.now() - start,
    };
  } catch (e) {
    return {
      component: "smtp:hostinger",
      component_type: "smtp",
      status: "down",
      latency_ms: Date.now() - start,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkCronHeartbeats(supabase: any): Promise<CheckResult[]> {
  const { data: hbs } = await supabase.from("cron_heartbeats").select("*");
  const results: CheckResult[] = [];
  for (const hb of hbs || []) {
    const ageMin = (Date.now() - new Date(hb.last_tick_at).getTime()) / 60000;
    const stale = ageMin > hb.expected_interval_minutes * 2;
    results.push({
      component: `cron:${hb.job_name}`,
      component_type: "cron",
      status: stale ? "down" : hb.last_status === "ok" ? "ok" : "warn",
      latency_ms: Math.round(ageMin),
      error_message: stale
        ? `No tick since ${Math.round(ageMin)}min (expected every ${hb.expected_interval_minutes}min)`
        : hb.last_error || undefined,
      metadata: { total_runs: hb.total_runs, failed_runs: hb.failed_runs },
    });
  }
  return results;
}

async function upsertIncident(
  supabase: any,
  check: CheckResult,
  channels: string[],
) {
  // Cherche incident ouvert
  const { data: existing } = await supabase
    .from("health_incidents")
    .select("id, occurrences_count, alert_channels_sent")
    .eq("component", check.component)
    .is("closed_at", null)
    .maybeSingle();

  if (check.status === "ok") {
    // Auto-fermeture si incident ouvert
    if (existing) {
      await supabase
        .from("health_incidents")
        .update({
          closed_at: new Date().toISOString(),
          resolution_notes: "Auto-resolved (status back to ok)",
        })
        .eq("id", existing.id);
    }
    return { incident: null, alertNeeded: false };
  }

  if (existing) {
    await supabase
      .from("health_incidents")
      .update({
        occurrences_count: (existing.occurrences_count || 0) + 1,
        last_occurrence_at: new Date().toISOString(),
        description: check.error_message || null,
      })
      .eq("id", existing.id);
    return { incident: existing, alertNeeded: false };
  }

  // Nouvel incident
  const severity = check.status === "down" ? "critical" : "warn";
  const { data: created } = await supabase
    .from("health_incidents")
    .insert({
      component: check.component,
      component_type: check.component_type,
      severity,
      title: `${check.component} → ${check.status.toUpperCase()}`,
      description: check.error_message || null,
      alert_channels_sent: channels,
      metadata: { http_status: check.http_status, latency_ms: check.latency_ms },
    })
    .select()
    .single();
  return { incident: created, alertNeeded: true };
}

async function sendEmailAlert(
  recipients: string[],
  check: CheckResult,
) {
  if (recipients.length === 0) return;
  const html = `
    <div style="font-family:system-ui;max-width:600px;margin:auto">
      <h2 style="color:#dc2626">Incident détecté — ${check.component}</h2>
      <p><strong>Statut:</strong> ${check.status}</p>
      <p><strong>Type:</strong> ${check.component_type}</p>
      ${check.error_message ? `<p><strong>Erreur:</strong> ${check.error_message}</p>` : ""}
      ${check.latency_ms ? `<p><strong>Latence:</strong> ${check.latency_ms}ms</p>` : ""}
      <p><a href="https://zandofy.com/admin/health" style="color:#16a34a">→ Ouvrir le dashboard santé</a></p>
      <hr/><small style="color:#666">Zandofy Monitoring · ${new Date().toISOString()}</small>
    </div>
  `;
  try {
    if (Deno.env.get("RESEND_API_KEY")) {
      const result = await sendEmail({
        to: recipients,
        subject: `[${check.status.toUpperCase()}] ${check.component}`,
        html,
      });
      if (!result.ok) console.error("[run-healthchecks] Resend alert failed:", result.error);
      return;
    }
    const host = Deno.env.get("SMTP_HOST");
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    if (!host || !user || !pass) return;
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(Deno.env.get("SMTP_PORT") || "587", 10),
      secure: false,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"Zandofy Monitoring" <${user}>`,
      to: recipients.join(","),
      subject: `[${check.status.toUpperCase()}] ${check.component}`,
      html,
    });
  } catch (e) {
    console.error("[run-healthchecks] email alert failed:", e);
  }
}

async function sendPushAlert(supabase: any, check: CheckResult) {
  // Notification in-app aux admins (consommée par les push subscriptions existantes)
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (!admins?.length) return;
  const rows = admins.map((a: any) => ({
    user_id: a.user_id,
    type: "system_alert",
    title: `🚨 ${check.component}`,
    body: check.error_message || `Status: ${check.status}`,
    link: "/admin/health",
  }));
  await supabase.from("notifications").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Heartbeat de cette EF elle-même
  await supabase.rpc("record_cron_heartbeat", {
    _job_name: "run-healthchecks",
    _status: "ok",
    _expected_interval_minutes: 5,
  });

  // Charge config
  const { data: settings } = await supabase
    .from("monitoring_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (settings && settings.enabled === false) {
    return new Response(JSON.stringify({ skipped: "monitoring disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const efThreshold = settings?.ef_latency_threshold_ms ?? 5000;
  const kelpayThreshold = settings?.kelpay_latency_threshold_ms ?? 8000;
  const recipients: string[] = settings?.alert_emails ?? [];
  const emailOn = settings?.alert_email_enabled ?? true;
  const pushOn = settings?.alert_push_enabled ?? true;

  const checks: CheckResult[] = [];

  // 1) Payment gateways (Keccel — same hosts as production Edge Functions)
  checks.push(await checkKelpay(kelpayThreshold));
  checks.push(await checkKeccelCard(kelpayThreshold));

  // 2) Edge Functions critiques (parallèle)
  const efResults = await Promise.all(
    CRITICAL_EDGE_FUNCTIONS.map((n) => checkEdgeFunctionAlive(supabase, n, efThreshold)),
  );
  checks.push(...efResults);

  // 3) Email — Resend (primary) + optional Hostinger SMTP legacy
  checks.push(await checkResend());
  const smtpLegacy = await checkSmtpLegacy();
  if (smtpLegacy) checks.push(smtpLegacy);

  // 4) Cron heartbeats
  checks.push(...(await checkCronHeartbeats(supabase)));

  // Persiste tous les checks
  await supabase.from("health_checks").insert(
    checks.map((c) => ({
      component: c.component,
      component_type: c.component_type,
      status: c.status,
      latency_ms: c.latency_ms ?? null,
      http_status: c.http_status ?? null,
      error_message: c.error_message ?? null,
      metadata: c.metadata ?? {},
    })),
  );

  // Gère incidents + alertes
  const channels: string[] = [];
  if (emailOn) channels.push("email");
  if (pushOn) channels.push("push");
  channels.push("banner");

  let alertsSent = 0;
  for (const c of checks) {
    const { alertNeeded } = await upsertIncident(supabase, c, channels);
    if (alertNeeded) {
      if (emailOn && recipients.length > 0) await sendEmailAlert(recipients, c);
      if (pushOn) await sendPushAlert(supabase, c);
      alertsSent++;
    }
  }

  // Cleanup : retention 30j sur health_checks
  await supabase.rpc("cleanup_old_health_checks").catch(() => {});

  return new Response(
    JSON.stringify({
      ok: true,
      total_checks: checks.length,
      down: checks.filter((c) => c.status === "down").length,
      warn: checks.filter((c) => c.status === "warn").length,
      alerts_sent: alertsSent,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});