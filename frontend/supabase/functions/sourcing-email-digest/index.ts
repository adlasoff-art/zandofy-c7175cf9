import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch pending un-digested requests
    const { data: pending, error: pErr } = await supabase
      .from("product_sourcing_requests")
      .select("id, product_name, note, created_at, user_id")
      .eq("status", "pending")
      .eq("admin_notified_email", false)
      .order("created_at", { ascending: true })
      .limit(50);
    if (pErr) throw pErr;

    // Trigger threshold: at least 5
    if (!pending || pending.length < 5) {
      return new Response(
        JSON.stringify({ skipped: true, count: pending?.length ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userIds = Array.from(new Set(pending.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", userIds);
    const profMap = new Map<string, any>();
    for (const p of profiles ?? []) profMap.set(p.id, p);

    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (adminRoles ?? []).map((r: any) => r.user_id);
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("email")
      .in("id", adminIds);
    const adminEmails = (adminProfiles ?? [])
      .map((p: any) => p.email)
      .filter((e: any) => !!e);
    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_admin_emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = pending
      .map((r) => {
        const p = profMap.get(r.user_id);
        const who = p
          ? escapeHtml(
              [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Client",
            )
          : "Client";
        const name = escapeHtml(r.product_name || "(sans nom)");
        const note = r.note ? escapeHtml(r.note).slice(0, 120) : "";
        return `<tr><td style="padding:8px;border-bottom:1px solid #eee">${name}</td><td style="padding:8px;border-bottom:1px solid #eee;color:#666">${who}</td><td style="padding:8px;border-bottom:1px solid #eee;color:#999">${note}</td></tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;background:#fff">
      <div style="max-width:680px;margin:0 auto">
        <h2>${pending.length} nouvelles demandes de produits</h2>
        <p>Voici la liste des dernières demandes de sourcing envoyées par les clients :</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr style="background:#f5f5f5"><th align="left" style="padding:8px">Produit</th><th align="left" style="padding:8px">Client</th><th align="left" style="padding:8px">Note</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:24px"><a href="https://zandofy.com/admin/sourcing" style="background:#0f9d58;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Ouvrir l'administration</a></p>
      </div>
    </body></html>`;


    await sendEmail({      to: fromEmail,
      bcc: adminEmails,
      subject: `[Zandofy] ${pending.length} nouvelles demandes produits`,
      html,
    });

    const ids = pending.map((r) => r.id);
    await supabase
      .from("product_sourcing_requests")
      .update({ admin_notified_email: true })
      .in("id", ids);

    return new Response(
      JSON.stringify({ success: true, sent: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sourcing-email-digest error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});