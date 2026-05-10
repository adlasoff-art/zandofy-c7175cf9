import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

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

function buildExpiryWarningEmail(firstName: string, balance: number, monthsLeft: number, expiryDate: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="padding:32px 32px 0;">
          <p style="font-size:40px;margin:0 0 8px;">⚠️</p>
          <h1 style="margin:0 0 12px;font-size:22px;color:#1a1a1a;">Vos ZandoPoints vont bientôt expirer !</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
            Bonjour ${firstName || "cher client"},<br><br>
            Vous avez <strong>${balance.toFixed(0)} ZandoPoints</strong> qui expireront le <strong>${expiryDate}</strong> 
            (dans ${monthsLeft} mois) si vous n'effectuez aucune activité sur votre compte.
          </p>
          <table cellpadding="0" cellspacing="0" style="background:#fff3cd;border-radius:8px;width:100%;margin-bottom:24px;border:1px solid #ffc107;">
            <tr><td style="padding:16px;">
              <p style="margin:0;font-size:13px;color:#856404;line-height:1.5;">
                💡 <strong>Pour conserver vos points :</strong> Effectuez un achat, convertissez-les en carte cadeau, ou parrainez un ami !
              </p>
            </td></tr>
          </table>
          <a href="https://zandofy.lovable.app/dashboard" style="display:inline-block;padding:12px 28px;background:#000;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Utiliser mes points</a>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#aaa;">Zandofy — Votre marketplace de confiance</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get referral settings for expiry months
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "referral_settings")
      .single();

    const expiryMonths = (settings?.value as any)?.points_expiry_months || 12;
    const warningMonths = 3; // Warn 3 months before expiry

    // Find users whose last activity is within the warning window
    // i.e. last_activity_at is between (expiryMonths - warningMonths) and expiryMonths ago
    const warningThreshold = new Date();
    warningThreshold.setMonth(warningThreshold.getMonth() - (expiryMonths - warningMonths));

    const expiryThreshold = new Date();
    expiryThreshold.setMonth(expiryThreshold.getMonth() - expiryMonths);

    const { data: atRiskAccounts, error: queryError } = await supabase
      .from("zando_points")
      .select("user_id, balance, last_activity_at")
      .gt("balance", 0)
      .lte("last_activity_at", warningThreshold.toISOString())
      .gt("last_activity_at", expiryThreshold.toISOString());

    if (queryError) throw queryError;

    if (!atRiskAccounts || atRiskAccounts.length === 0) {
      return new Response(JSON.stringify({ notified: 0, message: "No at-risk accounts found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profiles for these users
    const userIds = atRiskAccounts.map((a) => a.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name")
      .in("id", userIds);

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    // Setup SMTP
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");

    let emailsSent = 0;
    let inAppSent = 0;

    const transport = smtpHost && smtpUser && smtpPass && fromEmail
      ? nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        })
      : null;

    for (const account of atRiskAccounts) {
      const profile = profileMap[account.user_id];
      if (!profile) continue;

      const lastActivity = new Date(account.last_activity_at);
      const expiryDate = new Date(lastActivity);
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);
      
      const now = new Date();
      const monthsLeft = Math.max(1, Math.ceil((expiryDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
      const expiryDateStr = expiryDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

      // In-app notification
      await supabase.from("notifications").insert({
        user_id: account.user_id,
        type: "points",
        title: "⚠️ Points bientôt expirés",
        message: `Vos ${account.balance.toFixed(0)} ZandoPoints expireront le ${expiryDateStr}. Utilisez-les avant qu'il ne soit trop tard !`,
        link: "/dashboard",
      });
      inAppSent++;

      // Email notification
      if (transport && profile.email) {
        try {
          await sendEmail({            to: profile.email,
            subject: `⚠️ Vos ${account.balance.toFixed(0)} ZandoPoints expirent bientôt`,
            html: buildExpiryWarningEmail(profile.first_name || "", account.balance, monthsLeft, expiryDateStr),
          });
          emailsSent++;
        } catch (emailErr) {
          console.error(`Email error for ${profile.email}:`, emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ notified: atRiskAccounts.length, emailsSent, inAppSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-expiring-points error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
