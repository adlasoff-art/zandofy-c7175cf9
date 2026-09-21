/**
 * resolve-auth-identifier
 * Public (anon) — maps phone E.164 → auth email for password login.
 * Rate-limited; generic errors (no phone enumeration toast differences beyond timing).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimit(key: string): boolean {
  const now = Date.now();
  const cur = rateMap.get(key);
  if (!cur || now >= cur.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_MAX) return false;
  cur.count += 1;
  return true;
}

function normalizePhone(raw: string): string | null {
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 9) {
    digits = "243" + digits.slice(1);
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const ip = clientIp(req);
    let body: { phone?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
    if (!phone) {
      return json({ error: "invalid_credentials" }, 400);
    }

    if (!rateLimit(`${ip}|${phone}`)) {
      return json({ error: "rate_limited" }, 429);
    }

    // Constant-ish delay to reduce timing enumeration
    await new Promise((r) => setTimeout(r, 120 + Math.floor(Math.random() * 80)));

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const digits = phone.replace(/\D/g, "");
    const candidates = [phone, digits, `+${digits}`, `0${digits.slice(3)}`];

    let profileId: string | null = null;
    for (const p of candidates) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", p)
        .maybeSingle();
      if (data?.id) {
        profileId = data.id;
        break;
      }
    }

    if (!profileId) {
      return json({ error: "invalid_credentials" }, 404);
    }

    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(profileId);
    const email = userData?.user?.email;
    if (userErr || !email) {
      return json({ error: "invalid_credentials" }, 404);
    }

    return json({ email });
  } catch (e) {
    console.error("[resolve-auth-identifier]", e);
    return json({ error: "server_error" }, 500);
  }
});
