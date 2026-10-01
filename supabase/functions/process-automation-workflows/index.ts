// Automation workflows processor — runs hourly via pg_cron
// Processes email + push channels for active workflows.
// Popup channel is handled client-side via useAutomation hook.
// Additive: send window (outreach_config) + optional template_id from utility_message_templates.

import {
  interpolateOutreach,
  isWithinSendWindow,
  loadOutreachConfig,
  type UtilityTemplateRow,
} from "../_shared/outreach.ts";
import { sendEmail as sendResendEmail } from "../_shared/email.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Workflow {
  id: string;
  name: string;
  trigger_type: string;
  channel: string;
  delay_days: number;
  delay_minutes: number;
  condition_has_account: boolean | null;
  condition_has_order: boolean | null;
  condition_max_days_since_signup: number | null;
  display_frequency: string;
  max_displays: number | null;
  email_subject: string | null;
  email_html_content: string | null;
  push_title: string | null;
  push_body: string | null;
  popup_cta_link: string | null;
  template_id: string | null;
  ignore_send_window: boolean | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Optional hardening: if AUTOMATION_CRON_SECRET is set, require matching Bearer/x-cron-secret.
    // Cron today uses anon JWT — leave secret unset until cron headers are updated.
    const cronSecret = Deno.env.get("AUTOMATION_CRON_SECRET");
    if (cronSecret) {
      const auth = req.headers.get("Authorization") || "";
      const headerSecret = req.headers.get("x-cron-secret") || "";
      const ok =
        auth === `Bearer ${cronSecret}` ||
        headerSecret === cronSecret;
      if (!ok) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const outreachCfg = await loadOutreachConfig(supabase);

    const { data: workflows, error: wfErr } = await supabase
      .from("automation_workflows")
      .select("*")
      .eq("is_active", true)
      .in("channel", ["email", "push", "popup_push", "push_email", "all"])
      .order("sort_order", { ascending: true });

    if (wfErr) throw wfErr;
    if (!workflows || workflows.length === 0) {
      return jsonResponse({ processed: 0, message: "No active workflows" });
    }

    const summary = {
      workflows_evaluated: workflows.length,
      emails_sent: 0,
      pushes_sent: 0,
      skipped_outside_window: 0,
      users_skipped_already_processed: 0,
      errors: [] as string[],
    };

    for (const wf of workflows as Workflow[]) {
      try {
        if (!wf.ignore_send_window && !isWithinSendWindow(outreachCfg.default_send_window)) {
          summary.skipped_outside_window++;
          continue;
        }

        const eligibleUserIds = await getEligibleUsers(supabase, wf);
        if (eligibleUserIds.length === 0) continue;

        let template: UtilityTemplateRow | null = null;
        if (wf.template_id) {
          const { data: t } = await supabase
            .from("utility_message_templates")
            .select("*")
            .eq("id", wf.template_id)
            .eq("is_active", true)
            .maybeSingle();
          template = (t as UtilityTemplateRow) || null;
        }

        const emailSubject = template?.email_subject ?? wf.email_subject;
        const emailHtml = template?.email_html ?? wf.email_html_content;
        const pushTitle = template?.push_title ?? wf.push_title;
        const pushBody = template?.push_body ?? wf.push_body;

        const wantsEmail = ["email", "push_email", "all"].includes(wf.channel);
        const wantsPush = ["push", "popup_push", "push_email", "all"].includes(wf.channel);

        for (const userId of eligibleUserIds) {
          let sentSomething = false;
          let emailOk = false;

          // Email channel (independent of push for push_email / all)
          if (wantsEmail && emailSubject && emailHtml) {
            emailOk = await sendEmailResolved(supabase, userId, {
              subject: emailSubject,
              html: emailHtml,
              templateId: template?.id ?? null,
            });
            if (emailOk) {
              summary.emails_sent++;
              sentSomething = true;
            }
          }

          // Push: always for push / popup_push / push_email / all (restore dual-channel)
          // Also fallback when email-only failed (no address / Resend error)
          const shouldPush =
            (wantsPush && !!pushTitle && !!pushBody) ||
            (wantsEmail && !wantsPush && !emailOk && !!pushTitle && !!pushBody);

          if (shouldPush && pushTitle && pushBody) {
            const ok = await sendPushResolved(supabase, userId, {
              title: pushTitle,
              body: pushBody,
              url: wf.popup_cta_link || "/",
              templateId: template?.id ?? null,
            });
            if (ok) {
              summary.pushes_sent++;
              sentSomething = true;
            }
          }

          if (sentSomething) {
            await supabase.from("automation_user_progress").insert({
              user_id: userId,
              workflow_id: wf.id,
              display_count: 1,
              last_displayed_at: new Date().toISOString(),
              sent_at: new Date().toISOString(),
              status: "sent",
            });
          }
        }
      } catch (innerErr) {
        const msg = `Workflow ${wf.id} (${wf.name}): ${(innerErr as Error).message}`;
        console.error(msg);
        summary.errors.push(msg);
      }
    }

    return jsonResponse(summary);
  } catch (err) {
    console.error("process-automation-workflows fatal:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function getEligibleUsers(supabase: any, wf: Workflow): Promise<string[]> {
  let query = supabase.from("profiles").select("id, created_at, email");

  if (wf.delay_days > 0) {
    const target = new Date();
    target.setUTCDate(target.getUTCDate() - wf.delay_days);
    const start = new Date(target);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setUTCHours(23, 59, 59, 999);
    query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
  } else if (wf.condition_max_days_since_signup !== null) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - wf.condition_max_days_since_signup);
    query = query.gte("created_at", cutoff.toISOString());
  }

  const { data: profiles, error } = await query.limit(500);
  if (error) throw error;
  if (!profiles || profiles.length === 0) return [];

  let userIds: string[] = profiles.map((p: any) => p.id);

  const { data: existingProgress } = await supabase
    .from("automation_user_progress")
    .select("user_id, display_count")
    .eq("workflow_id", wf.id)
    .in("user_id", userIds);

  const processedMap = new Map<string, number>();
  (existingProgress || []).forEach((p: any) => {
    if (p.user_id) processedMap.set(p.user_id, p.display_count);
  });

  userIds = userIds.filter((id) => {
    const count = processedMap.get(id);
    if (count === undefined) return true;
    if (wf.display_frequency === "once") return false;
    if (wf.max_displays !== null && count >= wf.max_displays) return false;
    return false;
  });

  if (userIds.length === 0) return [];

  if (wf.condition_has_order !== null) {
    const { data: orderers } = await supabase
      .from("orders")
      .select("user_id")
      .in("user_id", userIds)
      .not("status", "in", '("cancelled","returned")');
    const orderUserIds = new Set((orderers || []).map((o: any) => o.user_id));

    if (wf.condition_has_order === false) {
      userIds = userIds.filter((id) => !orderUserIds.has(id));
    } else {
      userIds = userIds.filter((id) => orderUserIds.has(id));
    }
  }

  if (wf.trigger_type === "visit_no_order" || wf.trigger_type === "no_order_delay") {
    if (wf.condition_has_order === null) {
      const { data: orderers } = await supabase
        .from("orders")
        .select("user_id")
        .in("user_id", userIds)
        .not("status", "in", '("cancelled","returned")');
      const orderUserIds = new Set((orderers || []).map((o: any) => o.user_id));
      userIds = userIds.filter((id) => !orderUserIds.has(id));
    }
  }

  return userIds;
}

async function sendEmailResolved(
  supabase: any,
  userId: string,
  opts: { subject: string; html: string; templateId: string | null },
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.email) return false;

    const name =
      [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
      profile.first_name ||
      "";
    const vars = {
      name,
      first_name: profile.first_name || "",
      email: profile.email,
      cta_url: "https://www.zandofy.com",
    };
    const subject = interpolateOutreach(opts.subject, vars);
    const html = interpolateOutreach(opts.html, vars)
      .replace(/\{\{first_name\}\}/g, profile.first_name || "")
      .replace(/\{\{email\}\}/g, profile.email);

    const result = await sendResendEmail({
      to: profile.email,
      subject,
      html,
    });

    if (!result.ok) {
      console.error(`Email send failed for ${profile.email}:`, result.error);
      return false;
    }

    await supabase.from("outreach_send_log").insert({
      user_id: userId,
      template_id: opts.templateId,
      channel: "email",
      status: "sent",
      meta: { source: "process-automation-workflows" },
    });
    return true;
  } catch (err) {
    console.error(`sendEmail error for user ${userId}:`, err);
    return false;
  }
}

async function sendPushResolved(
  supabase: any,
  userId: string,
  opts: { title: string; body: string; url: string; templateId: string | null },
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", userId)
      .maybeSingle();

    const name =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      profile?.first_name ||
      "";
    const vars = {
      name,
      first_name: profile?.first_name || "",
      email: profile?.email || "",
      cta_url: opts.url || "https://www.zandofy.com",
    };
    const title = interpolateOutreach(opts.title, vars);
    const body = interpolateOutreach(opts.body, vars);

    // push-notifications?action=send-push inserts in-app + delivers Web Push
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let pushHttpOk = false;
    try {
      const pushRes = await fetch(
        `${supabaseUrl}/functions/v1/push-notifications?action=send-push`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userIds: [userId],
            title,
            body,
            url: opts.url || "/",
          }),
        },
      );
      pushHttpOk = pushRes.ok;
      if (!pushRes.ok) {
        // Fallback: in-app only
        await supabase.from("notifications").insert({
          user_id: userId,
          title,
          message: body,
          type: "promo",
          link: opts.url || null,
        });
      }
    } catch (e) {
      console.warn("push-notifications invoke failed, in-app fallback", e);
      await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message: body,
        type: "promo",
        link: opts.url || null,
      });
    }

    await supabase.from("outreach_send_log").insert({
      user_id: userId,
      template_id: opts.templateId,
      channel: "push",
      status: "sent",
      meta: {
        source: "process-automation-workflows",
        push_http_ok: pushHttpOk,
      },
    });
    return true;
  } catch (err) {
    console.error(`sendPush error for user ${userId}:`, err);
    return false;
  }
}
