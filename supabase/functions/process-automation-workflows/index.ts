// Automation workflows processor — runs hourly via pg_cron
// Processes email + push channels for active workflows.
// Popup channel is handled client-side via useAutomation hook.

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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch active workflows that have at least one non-popup channel
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
      users_skipped_already_processed: 0,
      errors: [] as string[],
    };

    for (const wf of workflows as Workflow[]) {
      try {
        const eligibleUserIds = await getEligibleUsers(supabase, wf);
        if (eligibleUserIds.length === 0) continue;

        const wantsEmail = ["email", "push_email", "all"].includes(wf.channel);
        const wantsPush = ["push", "popup_push", "push_email", "all"].includes(wf.channel);

        for (const userId of eligibleUserIds) {
          let sentSomething = false;

          // EMAIL
          if (wantsEmail && wf.email_subject && wf.email_html_content) {
            const ok = await sendEmail(supabase, userId, wf);
            if (ok) {
              summary.emails_sent++;
              sentSomething = true;
            }
          }

          // PUSH
          if (wantsPush && wf.push_title && wf.push_body) {
            const ok = await sendPush(supabase, userId, wf);
            if (ok) {
              summary.pushes_sent++;
              sentSomething = true;
            }
          }

          // Record progress only if at least one send succeeded
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
  // 1. Build profile candidates based on signup window
  let query = supabase.from("profiles").select("id, created_at, email");

  if (wf.delay_days > 0) {
    // Users who signed up exactly delay_days ago (24h window)
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

  // 2. Filter out users already processed for this workflow (idempotence)
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
    return false; // For email/push, default to once-per-workflow
  });

  if (userIds.length === 0) return [];

  // 3. condition_has_order filter
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

  // Trigger-based shortcuts
  if (wf.trigger_type === "visit_no_order" || wf.trigger_type === "no_order_delay") {
    // Already covered by condition_has_order=false above if set; otherwise re-apply
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

async function sendEmail(supabase: any, userId: string, wf: Workflow): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.email) return false;

    const html = (wf.email_html_content || "")
      .replace(/\{\{first_name\}\}/g, profile.first_name || "")
      .replace(/\{\{email\}\}/g, profile.email);

    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        to: profile.email,
        subject: wf.email_subject,
        html,
      },
    });

    if (error) {
      console.error(`Email send failed for ${profile.email}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`sendEmail error for user ${userId}:`, err);
    return false;
  }
}

async function sendPush(supabase: any, userId: string, wf: Workflow): Promise<boolean> {
  try {
    // Verify the user has at least one subscription
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (!count || count === 0) return false;

    const { error } = await supabase.functions.invoke("push-notifications", {
      body: {
        user_ids: [userId],
        title: wf.push_title,
        body: wf.push_body,
        url: wf.popup_cta_link || "/",
      },
    });

    if (error) {
      console.error(`Push send failed for user ${userId}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`sendPush error for user ${userId}:`, err);
    return false;
  }
}
