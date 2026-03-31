import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
const SMTP_FROM = Deno.env.get("SMTP_FROM_EMAIL") || "noreply@zandofy.com";

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

async function sendEmail(to: string, subject: string, html: string) {
  // Use SMTP via fetch to a mail relay, or construct raw SMTP
  // For Deno edge functions, we use the SMTPClient from deno std
  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465,
      auth: {
        username: SMTP_USER,
        password: SMTP_PASS,
      },
    },
  });

  await client.send({
    from: SMTP_FROM,
    to,
    subject,
    content: "auto",
    html,
  });

  await client.close();
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, storeName, expiresAt, type } = await req.json();

    if (!to || !storeName) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject: string;
    let html: string;

    if (type === "platform_owned") {
      subject = `⚠️ Votre boutique "${storeName}" — Changement de statut`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
            <h2 style="color: #dc2626; margin: 0 0 16px;">⚠️ Changement de statut de votre boutique</h2>
            <p style="color: #374151; line-height: 1.6;">
              Bonjour,
            </p>
            <p style="color: #374151; line-height: 1.6;">
              Votre boutique <strong>"${storeName}"</strong> a été marquée comme <strong>appartenant à la plateforme Zandofy</strong> par un administrateur.
            </p>
            <p style="color: #374151; line-height: 1.6;">
              Cela signifie que les revenus générés par cette boutique ne seront plus crédités sur votre wallet vendeur.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #991b1b; margin: 0; font-weight: 600;">
                📅 Vous avez jusqu'au ${expiresAt || "72h après activation"} pour contester cette décision.
              </p>
              <p style="color: #991b1b; margin: 8px 0 0;">
                Rendez-vous dans votre <strong>espace vendeur</strong> pour revendiquer le statut indépendant si c'est une erreur.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
              Si vous ne réagissez pas dans les 72 heures, le statut sera considéré comme confirmé et seul l'administrateur pourra le modifier.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Cet email a été envoyé automatiquement par Zandofy. Ne répondez pas à cet email.
            </p>
          </div>
        </div>
      `;
    } else if (type === "reverted_independent") {
      subject = `✅ Votre boutique "${storeName}" est redevenue indépendante`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
            <h2 style="color: #059669; margin: 0 0 16px;">✅ Boutique redevenue indépendante</h2>
            <p style="color: #374151; line-height: 1.6;">
              Bonne nouvelle ! Votre boutique <strong>"${storeName}"</strong> est à nouveau considérée comme <strong>indépendante</strong>.
            </p>
            <p style="color: #374151; line-height: 1.6;">
              Les revenus générés seront de nouveau crédités sur votre wallet vendeur, après déduction de la commission plateforme.
            </p>
          </div>
        </div>
      `;
    } else {
      return new Response(JSON.stringify({ error: "Unknown email type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendEmail(to, subject, html);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
