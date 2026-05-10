import { sendEmail } from "../_shared/email.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get active workflows with push/email channels and delay > 0
    const { data: workflows, error: wfErr } = await supabaseAdmin
      .from("automation_workflows")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (wfErr || !workflows || workflows.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No active workflows" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const emailWorkflows = workflows.filter((w: any) =>
      ["email", "push_email", "all"].includes(w.channel)
    );
    const pushWorkflows = workflows.filter((w: any) =>
      ["push", "popup_push", "push_email", "all"].includes(w.channel)
    );

    let totalProcessed = 0;

    // 2. Process push notifications
    for (const wf of pushWorkflows) {
      if (!wf.push_title || !wf.push_body) continue;

      const eligibleUsers = await getEligibleUsers(supabaseAdmin, wf);
      if (eligibleUsers.length === 0) continue;

      for (const userId of eligibleUsers) {
        // Get push subscriptions
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", userId);

        if (!subs || subs.length === 0) continue;

        // Record progress (skip actual push send — use existing push-notifications function)
        await supabaseAdmin.from("automation_user_progress").insert({
          user_id: userId,
          workflow_id: wf.id,
          display_count: 1,
          last_displayed_at: new Date().toISOString(),
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        // Invoke the existing push-notifications function
        try {
          await supabaseAdmin.functions.invoke("push-notifications", {
            body: {
              user_ids: [userId],
              title: wf.push_title,
              body: wf.push_body,
              url: wf.popup_cta_link || "/",
            },
          });
        } catch (pushErr) {
          console.error(`Push failed for user ${userId}:`, pushErr);
        }

        totalProcessed++;
      }
    }

    // 3. Process emails with stagger

    if (emailWorkflows.length > 0) {

      for (const wf of emailWorkflows) {
        if (!wf.email_subject || !wf.email_html_content) continue;

        const eligibleUsers = await getEligibleUsers(supabaseAdmin, wf);
        if (eligibleUsers.length === 0) continue;

        // Process in batches of 10 with 2-3 min stagger
        for (let i = 0; i < eligibleUsers.length; i++) {
          const userId = eligibleUsers[i];

          // Get user email
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("email, first_name")
            .eq("id", userId)
            .maybeSingle();

          if (!profile?.email) continue;

          try {
            const htmlContent = wf.email_html_content
              .replace(/\{\{first_name\}\}/g, profile.first_name || "")
              .replace(/\{\{email\}\}/g, profile.email);

            await sendEmail({              to: profile.email,
              subject: wf.email_subject,
              html: htmlContent,
            });

            await supabaseAdmin.from("automation_user_progress").insert({
              user_id: userId,
              workflow_id: wf.id,
              display_count: 1,
              last_displayed_at: new Date().toISOString(),
              status: "sent",
              sent_at: new Date().toISOString(),
            });

            totalProcessed++;
          } catch (emailErr) {
            console.error(`Email failed for ${profile.email}:`, emailErr);
          }

          // Stagger: 2-3 min between emails (random 120-180s)
          if (i < eligibleUsers.length - 1) {
            const delay = 120000 + Math.random() * 60000;
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-automation error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

async function getEligibleUsers(supabase: any, wf: any): Promise<string[]> {
  // Build query for profiles created within the workflow's time window
  let query = supabase.from("profiles").select("id, created_at");

  // Filter by days since signup
  if (wf.delay_days > 0) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - wf.delay_days);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.gte("created_at", startOfDay.toISOString()).lte("created_at", endOfDay.toISOString());
  }

  if (wf.condition_max_days_since_signup !== null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - wf.condition_max_days_since_signup);
    query = query.gte("created_at", cutoff.toISOString());
  }

  const { data: profiles } = await query.limit(100);
  if (!profiles || profiles.length === 0) return [];

  const userIds = profiles.map((p: any) => p.id);

  // Filter out users who already received this workflow
  const { data: progress } = await supabase
    .from("automation_user_progress")
    .select("user_id")
    .eq("workflow_id", wf.id)
    .in("user_id", userIds);

  const processedIds = new Set((progress || []).map((p: any) => p.user_id));
  let eligible = userIds.filter((id: string) => !processedIds.has(id));

  // Apply condition_has_order filter
  if (wf.condition_has_order === false) {
    const { data: orderers } = await supabase
      .from("orders")
      .select("user_id")
      .in("user_id", eligible)
      .not("status", "in", '("cancelled","returned")');
    const ordererIds = new Set((orderers || []).map((o: any) => o.user_id));
    eligible = eligible.filter((id: string) => !ordererIds.has(id));
  } else if (wf.condition_has_order === true) {
    const { data: orderers } = await supabase
      .from("orders")
      .select("user_id")
      .in("user_id", eligible)
      .not("status", "in", '("cancelled","returned")');
    const ordererIds = new Set((orderers || []).map((o: any) => o.user_id));
    eligible = eligible.filter((id: string) => ordererIds.has(id));
  }

  return eligible;
}
