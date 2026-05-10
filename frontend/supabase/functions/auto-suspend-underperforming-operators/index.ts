/**
 * auto-suspend-underperforming-operators — Lot 11B Phase B9
 *
 * Cron-friendly. Recalcule la fiabilité de tous les opérateurs approuvés et
 * suspend automatiquement ceux qui dérivent (score < min_score OU
 * expiry_rate > max_expiry_rate_pct OU decline_rate > max_decline_rate_pct),
 * uniquement si auto_suspend_enabled = true et que l'opérateur dépasse
 * min_assignments sur la fenêtre.
 *
 * - Très Speed Delivery (is_platform_owned) est exclu.
 * - Notifie admins/managers (in-app) + owner opérateur (in-app + email).
 *
 * Auth : verify_jwt = false (cron / admin tooling).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { operatorAutoSuspendEmail } from "../_shared/operator-email-templates.ts";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Charger les seuils actifs.
    const { data: thresholds } = await svc
      .from("delivery_operator_thresholds")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!thresholds) {
      return json({ ok: true, message: "no thresholds configured", suspended: 0 });
    }

    // 2. Refresh tous les scores via RPC (persiste reliability_score).
    await svc.rpc("refresh_all_operator_reliability");

    if (!thresholds.auto_suspend_enabled) {
      return json({
        ok: true,
        message: "auto-suspend disabled — scores refreshed only",
        suspended: 0,
      });
    }

    // 3. Lister les opérateurs candidats à la suspension.
    const { data: ops } = await svc
      .from("delivery_operators")
      .select("id, owner_user_id, company_name, contact_email")
      .eq("status", "approved")
      .eq("is_active", true)
      .eq("is_platform_owned", false);

    let suspended = 0;
    const reports: any[] = [];

    for (const op of ops || []) {
      // Calcul à la volée pour avoir les rates fraîches.
      const { data: kpiArr } = await svc.rpc("compute_operator_reliability", {
        p_operator_id: op.id,
        p_window_days: thresholds.window_days,
      });
      const kpi = Array.isArray(kpiArr) ? kpiArr[0] : kpiArr;
      if (!kpi) continue;

      // Pas assez de données pour juger.
      if (Number(kpi.total_assignments) < thresholds.min_assignments) continue;

      const reasons: string[] = [];
      if (kpi.score !== null && Number(kpi.score) < Number(thresholds.min_score)) {
        reasons.push(`score ${kpi.score} < seuil ${thresholds.min_score}`);
      }
      if (Number(kpi.expiry_rate) > Number(thresholds.max_expiry_rate_pct)) {
        reasons.push(
          `taux d'expiration ${kpi.expiry_rate}% > ${thresholds.max_expiry_rate_pct}%`,
        );
      }
      if (Number(kpi.decline_rate) > Number(thresholds.max_decline_rate_pct)) {
        reasons.push(
          `taux de refus ${kpi.decline_rate}% > ${thresholds.max_decline_rate_pct}%`,
        );
      }
      if (reasons.length === 0) continue;

      const reasonText = reasons.join(" ; ");

      // Suspension : is_active=false + traçabilité.
      const { error: updErr } = await svc
        .from("delivery_operators")
        .update({
          is_active: false,
          status: "suspended",
          auto_suspended_at: new Date().toISOString(),
          auto_suspension_reason: reasonText,
        })
        .eq("id", op.id);
      if (updErr) {
        console.error("[auto-suspend] update error", op.id, updErr);
        continue;
      }

      // Notif in-app à l'owner opérateur.
      await svc.from("notifications").insert({
        user_id: op.owner_user_id,
        type: "error",
        title: "⚠️ Compte opérateur suspendu",
        message: `Suspension automatique : ${reasonText}.`,
        link: "/operator",
      });

      // Notif in-app aux admins/managers.
      const { data: adminRows } = await svc
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "manager"]);
      for (const a of adminRows || []) {
        await svc.from("notifications").insert({
          user_id: a.user_id,
          type: "warning",
          title: "Opérateur suspendu (auto)",
          message: `${op.company_name} — ${reasonText}`,
          link: "/admin/operators-performance",
        });
      }

      // Email best-effort à l'owner.
      await sendSuspensionEmail(op, kpi, thresholds.window_days, reasonText);

      suspended++;
      reports.push({ operator_id: op.id, reasons: reasonText, score: kpi.score });
    }

    return json({ ok: true, suspended, reports });
  } catch (e) {
    console.error("[auto-suspend] fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendSuspensionEmail(
  op: { company_name: string; contact_email: string; owner_user_id: string },
  kpi: { score: number | null },
  windowDays: number,
  reasonText: string,
) {
  try {
    if (!op.contact_email || !smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      return;
    }
    const html = operatorAutoSuspendEmail({
      greeting: "Bonjour,",
      companyName: op.company_name,
      reason: reasonText,
      score: kpi.score !== null ? Number(kpi.score).toFixed(2) : null,
      windowDays,
    });
    await sendEmail({      to: op.contact_email,
      subject: `⚠️ ${op.company_name} — Suspension automatique`,
      html,
    });
  } catch (err) {
    console.error("[auto-suspend] email failed", err);
  }
}