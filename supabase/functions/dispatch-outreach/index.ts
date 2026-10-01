/**
 * dispatch-outreach — send a utility template via email / push / in_app / whatsapp_cloud.
 * Auth: admin|manager JWT, or exact service_role Bearer.
 * wa.me is NEVER sent here (manual admin UI only).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";
import {
  interpolateOutreach,
  loadOutreachConfig,
  logOutreach,
  type OutreachChannel,
  type UtilityTemplateRow,
} from "../_shared/outreach.ts";

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

const DEFAULT_CTA = "https://www.zandofy.com";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const svc = createClient(supabaseUrl, serviceKey);

    let actorAdminId: string | null = null;
    const isService = authHeader === `Bearer ${serviceKey}`;

    if (!isService) {
      if (!authHeader.startsWith("Bearer ")) {
        return json({ error: "Unauthorized" }, 401);
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) return json({ error: "Unauthorized" }, 401);

      const { data: roles } = await svc
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const ok = roles?.some(
        (r: { role: string }) => r.role === "admin" || r.role === "manager",
      );
      if (!ok) return json({ error: "Forbidden" }, 403);
      actorAdminId = user.id;
    }

    const body = await req.json();
    const userId = body.user_id as string | undefined;
    const channel = body.channel as OutreachChannel | undefined;
    const templateId = body.template_id as string | undefined;
    const templateSlug = body.template_slug as string | undefined;
    const varsIn = (body.vars || {}) as Record<string, string>;

    if (!userId || !channel) {
      return json({ error: "user_id and channel required" }, 400);
    }
    if (channel === "whatsapp_me") {
      return json({
        error: "whatsapp_me is manual-only (admin UI)",
        ok: false,
      }, 400);
    }

    let templateQuery = svc
      .from("utility_message_templates")
      .select("*")
      .eq("is_active", true);
    if (templateId) templateQuery = templateQuery.eq("id", templateId);
    else if (templateSlug) templateQuery = templateQuery.eq("slug", templateSlug);
    else return json({ error: "template_id or template_slug required" }, 400);

    const { data: template, error: tErr } = await templateQuery.maybeSingle();
    if (tErr || !template) {
      return json({ error: "Template not found or inactive" }, 404);
    }
    const t = template as UtilityTemplateRow;
    if (Array.isArray(t.channels) && !t.channels.includes(channel)) {
      return json({ error: `Template does not support channel ${channel}` }, 400);
    }

    const { data: profile } = await svc
      .from("profiles")
      .select("id, email, first_name, last_name, phone, phone_e164, whatsapp_opt_in")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) return json({ error: "User not found" }, 404);

    const name =
      [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
      profile.email ||
      "client";
    const vars: Record<string, string> = {
      name,
      cta_url: varsIn.cta_url || DEFAULT_CTA,
      email: profile.email || "",
      first_name: profile.first_name || "",
      ...varsIn,
    };

    let effectiveChannel = channel;
    if (channel === "email" && !profile.email) {
      effectiveChannel = "push";
    }

    if (effectiveChannel === "email") {
      const subject = interpolateOutreach(t.email_subject, vars);
      const html = interpolateOutreach(t.email_html, vars);
      if (!subject || !html || !profile.email) {
        await logOutreach(svc, {
          user_id: userId,
          template_id: t.id,
          channel: "email",
          status: "skipped",
          actor_admin_id: actorAdminId,
          meta: { reason: "missing_content_or_email" },
        });
        return json({ ok: false, reason: "missing_content_or_email" });
      }
      const result = await sendEmail({ to: profile.email, subject, html });
      await logOutreach(svc, {
        user_id: userId,
        template_id: t.id,
        channel: "email",
        status: result.ok ? "sent" : "failed",
        actor_admin_id: actorAdminId,
        meta: { to: profile.email, resend_ok: result.ok, error: result.error },
      });
      return json({ ok: result.ok, channel: "email", error: result.error });
    }

    if (effectiveChannel === "push" || effectiveChannel === "in_app") {
      const title = interpolateOutreach(
        effectiveChannel === "in_app"
          ? t.in_app_title || t.push_title
          : t.push_title || t.in_app_title,
        vars,
      );
      const message = interpolateOutreach(
        effectiveChannel === "in_app"
          ? t.in_app_message || t.push_body
          : t.push_body || t.in_app_message,
        vars,
      );
      if (!title || !message) {
        await logOutreach(svc, {
          user_id: userId,
          template_id: t.id,
          channel: effectiveChannel,
          status: "skipped",
          actor_admin_id: actorAdminId,
          meta: { reason: "missing_content" },
        });
        return json({ ok: false, reason: "missing_content" });
      }

      // Single path: push-notifications?action=send-push does in-app + web push
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
              body: message,
              url: vars.cta_url || "/",
            }),
          },
        );
        if (!pushRes.ok) {
          // Fallback: in-app only if push function rejects
          await svc.from("notifications").insert({
            user_id: userId,
            title,
            message,
            type: "promo",
            link: vars.cta_url || null,
          });
        }
      } catch (e) {
        console.warn("[dispatch-outreach] push invoke", e);
        await svc.from("notifications").insert({
          user_id: userId,
          title,
          message,
          type: "promo",
          link: vars.cta_url || null,
        });
      }

      await logOutreach(svc, {
        user_id: userId,
        template_id: t.id,
        channel: effectiveChannel,
        status: "sent",
        actor_admin_id: actorAdminId,
        meta: { fallback_from_email: channel === "email" },
      });
      return json({ ok: true, channel: effectiveChannel });
    }

    if (effectiveChannel === "whatsapp_cloud") {
      if (t.category === "marketing" && profile.whatsapp_opt_in !== true) {
        await logOutreach(svc, {
          user_id: userId,
          template_id: t.id,
          channel: "whatsapp_cloud",
          status: "skipped",
          actor_admin_id: actorAdminId,
          meta: { reason: "opt_in_required" },
        });
        return json({ ok: false, reason: "opt_in_required" });
      }

      const cfg = await loadOutreachConfig(svc);
      const enabledEnv = Deno.env.get("WHATSAPP_CLOUD_ENABLED") === "true";
      // Both flags must allow send (defense in depth)
      if (!cfg.whatsapp_cloud_enabled || !enabledEnv) {
        await logOutreach(svc, {
          user_id: userId,
          template_id: t.id,
          channel: "whatsapp_cloud",
          status: "disabled",
          actor_admin_id: actorAdminId,
          meta: {
            reason: "cloud_disabled",
            settings_flag: cfg.whatsapp_cloud_enabled,
            env_flag: enabledEnv,
          },
        });
        return json({ ok: false, reason: "cloud_disabled" });
      }

      if (!t.whatsapp_cloud_template_name) {
        return json({ ok: false, reason: "missing_cloud_template_name" }, 400);
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-cloud-send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          template_id: t.id,
          phone_e164: profile.phone_e164 || profile.phone,
          template_name: t.whatsapp_cloud_template_name,
          language: t.whatsapp_cloud_language || "fr",
          vars,
          actor_admin_id: actorAdminId,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      return json({ ok: res.ok && payload?.ok === true, ...payload }, res.status);
    }

    return json({ error: `Unsupported channel: ${channel}` }, 400);
  } catch (err) {
    console.error("[dispatch-outreach]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
