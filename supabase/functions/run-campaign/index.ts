import nodemailer from "nodemailer";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Verify admin via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin" || r.role === "manager");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Action: run-campaign — processes a specific campaign
    if (action === "run-campaign") {
      const { campaignId } = body;
      if (!campaignId) {
        return new Response(JSON.stringify({ error: "campaignId required" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Get campaign
      const { data: campaign } = await serviceClient
        .from("scheduled_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      if (!campaign) {
        return new Response(JSON.stringify({ error: "Campaign not found" }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Determine eligible users
      let eligibleUsers: any[] = [];

      if (campaign.campaign_type === "birthday") {
        // Find users whose birthday is today
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("id, email, first_name, date_of_birth")
          .not("email", "is", null)
          .not("date_of_birth", "is", null);

        eligibleUsers = (profiles || []).filter((p: any) => {
          const dob = new Date(p.date_of_birth);
          return dob.getMonth() + 1 === month && dob.getDate() === day;
        });
      } else {
        // Holiday campaigns — send to all users with email
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("id, email, first_name")
          .not("email", "is", null);
        eligibleUsers = profiles || [];
      }

      // Exclude already-sent users for this campaign this year
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const { data: alreadySent } = await serviceClient
        .from("campaign_send_log")
        .select("user_id")
        .eq("campaign_id", campaignId)
        .gte("sent_at", yearStart);
      const sentIds = new Set((alreadySent || []).map((s: any) => s.user_id));
      eligibleUsers = eligibleUsers.filter((u: any) => !sentIds.has(u.id));

      if (eligibleUsers.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0, message: "No eligible users" }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Get order counts for personalization
      const userIds = eligibleUsers.map((u: any) => u.id);
      const { data: orderCounts } = await serviceClient
        .from("orders")
        .select("user_id")
        .in("user_id", userIds)
        .eq("status", "delivered");
      
      const countMap: Record<string, number> = {};
      (orderCounts || []).forEach((o: any) => {
        countMap[o.user_id] = (countMap[o.user_id] || 0) + 1;
      });

      // SMTP setup
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASS");
      const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");

      if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
        return new Response(JSON.stringify({ error: "SMTP not configured" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const transport = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      let sentCount = 0;
      const batchSize = campaign.batch_size || 10;

      for (let i = 0; i < eligibleUsers.length; i += batchSize) {
        const batch = eligibleUsers.slice(i, i + batchSize);
        
        for (const u of batch) {
          const html = campaign.html_content
            .replace(/\{\{name\}\}/g, u.first_name || "Client")
            .replace(/\{\{order_count\}\}/g, String(countMap[u.id] || 0))
            .replace(/\{\{promo_code\}\}/g, campaign.promo_code || "");

          try {
            await transport.sendMail({
              from: fromEmail,
              to: u.email,
              subject: campaign.subject.replace(/\{\{name\}\}/g, u.first_name || "Client"),
              html,
            });

            await serviceClient.from("campaign_send_log").insert({
              campaign_id: campaignId,
              user_id: u.id,
              status: "sent",
            });
            sentCount++;
          } catch (err: any) {
            await serviceClient.from("campaign_send_log").insert({
              campaign_id: campaignId,
              user_id: u.id,
              status: "failed",
              error_message: err.message?.slice(0, 500),
            });
          }
        }

        // Delay between batches (within edge function timeout)
        if (i + batchSize < eligibleUsers.length) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      // Update last_run_at
      await serviceClient
        .from("scheduled_campaigns")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", campaignId);

      return new Response(JSON.stringify({ success: true, sent: sentCount, total: eligibleUsers.length }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Campaign error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
