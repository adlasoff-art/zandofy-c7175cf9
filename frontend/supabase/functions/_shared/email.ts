/**
 * Shared Resend email helper.
 *
 * Migration: Hostinger SMTP (nodemailer) → Resend HTTP API.
 * - Reuses SMTP_FROM_EMAIL as the default From address (e.g. "Zandofy <noreply@zandofy.com>").
 * - Requires RESEND_API_KEY (configured in Vault / Cloud secrets).
 * - Falls back to "noreply@zandofy.com" if SMTP_FROM_EMAIL is not set.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  id?: string;
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Send a single email via Resend.
 * Throws on hard failures (missing API key, network error). Returns result with `ok=false`
 * for soft failures (Resend 4xx/5xx) so callers can decide whether to throw.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from =
    opts.from ||
    Deno.env.get("SMTP_FROM_EMAIL") ||
    "Zandofy <noreply@zandofy.com>";

  const payload: Record<string, unknown> = {
    from,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.text) payload.text = opts.text;
  if (opts.replyTo) payload.reply_to = opts.replyTo;
  if (opts.cc) payload.cc = Array.isArray(opts.cc) ? opts.cc : [opts.cc];
  if (opts.bcc) payload.bcc = Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc];
  if (opts.tags) payload.tags = opts.tags;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const errMsg = body?.message || body?.error || `Resend HTTP ${res.status}`;
    console.error("Resend send failed:", res.status, errMsg, body);
    return { ok: false, status: res.status, error: errMsg };
  }

  return { ok: true, status: res.status, id: body?.id };
}

/**
 * Backwards-compatible helper that throws on failure (mirrors nodemailer's sendMail).
 */
export async function sendEmailOrThrow(opts: SendEmailOptions): Promise<SendEmailResult> {
  const result = await sendEmail(opts);
  if (!result.ok) {
    throw new Error(result.error || "Failed to send email");
  }
  return result;
}