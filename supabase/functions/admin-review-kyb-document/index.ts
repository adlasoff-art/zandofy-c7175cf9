/**
 * admin-review-kyb-document — Lot final consolidation
 *
 * Approuve ou rejette un document KYB d'opérateur. Notifie l'owner.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  document_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  rejection_reason: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const adminId = userData.user.id;

    const svc = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", adminId);
    const isStaff = roles?.some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
    }
    const { document_id, decision, rejection_reason } = parsed.data;

    if (decision === "rejected" && (!rejection_reason || rejection_reason.trim().length < 3)) {
      return json({ error: "Motif de rejet requis (min 3 caractères)" }, 400);
    }

    const { data: doc, error: docErr } = await svc
      .from("operator_kyb_documents")
      .select("id, status, operator_id, doc_type")
      .eq("id", document_id)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Document introuvable" }, 404);

    const { error: updErr } = await svc
      .from("operator_kyb_documents")
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        rejection_reason: decision === "rejected" ? rejection_reason : null,
      })
      .eq("id", document_id);
    if (updErr) return json({ error: "Update failed", details: updErr.message }, 500);

    // Notif owner
    try {
      const { data: op } = await svc
        .from("delivery_operators")
        .select("owner_user_id, company_name, contact_email")
        .eq("id", doc.operator_id)
        .maybeSingle();
      if (op?.owner_user_id) {
        await svc.from("notifications").insert({
          user_id: op.owner_user_id,
          type: decision === "approved" ? "operator_kyb_doc_approved" : "operator_kyb_doc_rejected",
          title: decision === "approved" ? "Document KYB approuvé" : "Document KYB rejeté",
          message:
            decision === "approved"
              ? `Votre ${doc.doc_type.toUpperCase()} a été validé.`
              : `Votre ${doc.doc_type.toUpperCase()} a été rejeté : ${rejection_reason}`,
          link: "/operator/settings",
        });
      }

      // Email transactionnel (best-effort, ne bloque jamais)
      try {
        const { data: profile } = await svc
          .from("profiles")
          .select("email")
          .eq("id", op?.owner_user_id)
          .maybeSingle();
        const recipient = profile?.email || op?.contact_email;
        if (recipient) {
          const subject =
            decision === "approved"
              ? `✅ Document KYB approuvé — ${op?.company_name ?? ""}`
              : `❌ Document KYB rejeté — ${op?.company_name ?? ""}`;
          const docLabel = doc.doc_type.toUpperCase();
          const html =
            decision === "approved"
              ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
                    <h2 style="color:#059669;margin:0 0 16px">✅ Document KYB approuvé</h2>
                    <p style="color:#374151;line-height:1.6">Bonjour,</p>
                    <p style="color:#374151;line-height:1.6">Votre document <strong>${docLabel}</strong> pour <strong>${op?.company_name ?? ""}</strong> a été validé par l'équipe Zandofy.</p>
                    <p style="color:#374151;line-height:1.6">Vous pouvez consulter le statut de tous vos documents depuis votre espace opérateur.</p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
                    <p style="color:#9ca3af;font-size:12px;margin:0">Email automatique Zandofy. Ne pas répondre.</p>
                  </div>
                </div>`
              : `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
                    <h2 style="color:#dc2626;margin:0 0 16px">❌ Document KYB rejeté</h2>
                    <p style="color:#374151;line-height:1.6">Bonjour,</p>
                    <p style="color:#374151;line-height:1.6">Votre document <strong>${docLabel}</strong> pour <strong>${op?.company_name ?? ""}</strong> n'a pas pu être validé.</p>
                    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
                      <p style="color:#991b1b;margin:0"><strong>Motif :</strong> ${rejection_reason}</p>
                    </div>
                    <p style="color:#374151;line-height:1.6">Merci de soumettre à nouveau un document conforme depuis votre espace opérateur.</p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
                    <p style="color:#9ca3af;font-size:12px;margin:0">Email automatique Zandofy. Ne pas répondre.</p>
                  </div>
                </div>`;

          const SMTP_HOST = Deno.env.get("SMTP_HOST");
          const SMTP_USER = Deno.env.get("SMTP_USER");
          const SMTP_PASS = Deno.env.get("SMTP_PASS");
          const SMTP_FROM = Deno.env.get("SMTP_FROM_EMAIL") || "noreply@zandofy.com";
          const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");

          if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
            const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
            const client = new SMTPClient({
              connection: {
                hostname: SMTP_HOST,
                port: SMTP_PORT,
                tls: SMTP_PORT === 465,
                auth: { username: SMTP_USER, password: SMTP_PASS },
              },
            });
            await client.send({ from: SMTP_FROM, to: recipient, subject, content: "auto", html });
            await client.close();
          } else {
            console.warn("[admin-review-kyb-document] SMTP env missing, email skipped");
          }
        }
      } catch (mailErr) {
        console.warn("[admin-review-kyb-document] email send failed", mailErr);
      }
    } catch (e) {
      console.warn("[admin-review-kyb-document] notif failed", e);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[admin-review-kyb-document] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}