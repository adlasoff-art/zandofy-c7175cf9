/**
 * publish-social-product
 * Processes social_post_jobs: Facebook first, then Instagram.
 *
 * Auth (required — function may be deployed with --no-verify-jwt):
 *  - Bearer user JWT of admin/manager, OR
 *  - Bearer SOCIAL_PUBLISH_CRON_SECRET (or x-cron-secret header)
 *
 * Secrets: META_PAGE_ID, META_PAGE_ACCESS_TOKEN, META_IG_BUSINESS_ID,
 *          SOCIAL_PUBLISH_ENABLED, SOCIAL_PUBLISH_CRON_SECRET (optional)
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 10;
const STALE_PROCESSING_MS = 10 * 60 * 1000; // 10 minutes

type Job = {
  id: string;
  product_id: string;
  platform: "facebook" | "instagram";
  status: string;
  image_mode: "primary" | "all";
  caption_snapshot: string | null;
  image_urls: string[] | unknown;
  attempts: number;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function asUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => String(u || "").trim())
    .filter((u) => /^https:\/\//i.test(u));
}

/** Meta Page APIs are more reliable with form-urlencoded + access_token. */
async function graphForm(
  path: string,
  token: string,
  fields: Record<string, string | boolean | number>,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams();
  body.set("access_token", token);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    body.set(k, typeof v === "string" ? v : String(v));
  }
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error?.message || JSON.stringify(data) || res.statusText;
    throw new Error(`Meta ${res.status}: ${msg}`);
  }
  return data as Record<string, unknown>;
}

async function graphGet(path: string, token: string) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error?.message || JSON.stringify(data) || res.statusText;
    throw new Error(`Meta GET ${res.status}: ${msg}`);
  }
  return data as Record<string, unknown>;
}

async function publishFacebookPrimary(
  pageId: string,
  token: string,
  imageUrl: string,
  caption: string,
): Promise<{ id: string; permalink?: string }> {
  const data = await graphForm(`/${pageId}/photos`, token, {
    url: imageUrl,
    caption,
    published: true,
  });
  const id = String(data.id || data.post_id || "");
  let permalink: string | undefined;
  if (id) {
    try {
      const meta = await graphGet(`/${id}?fields=link,permalink_url`, token);
      permalink = String((meta as any).permalink_url || (meta as any).link || "") || undefined;
    } catch {
      /* optional */
    }
  }
  return { id, permalink };
}

async function publishFacebookAlbum(
  pageId: string,
  token: string,
  urls: string[],
  caption: string,
): Promise<{ id: string; permalink?: string; partialError?: string }> {
  try {
    const mediaIds: string[] = [];
    for (const u of urls.slice(0, 10)) {
      const photo = await graphForm(`/${pageId}/photos`, token, {
        url: u,
        published: false,
      });
      if (photo.id) mediaIds.push(String(photo.id));
    }
    if (mediaIds.length === 0) throw new Error("Facebook album: no media uploaded");

    // attached_media as repeated form keys
    const body = new URLSearchParams();
    body.set("access_token", token);
    body.set("message", caption);
    mediaIds.forEach((id, i) => {
      body.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id }));
    });
    const res = await fetch(`${GRAPH}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as any)?.error?.message || JSON.stringify(data) || res.statusText;
      throw new Error(`Meta feed ${res.status}: ${msg}`);
    }
    return { id: String((data as any).id || "") };
  } catch (e) {
    // Plan fallback: post primary image only
    const partialError = e instanceof Error ? e.message : String(e);
    const primary = await publishFacebookPrimary(pageId, token, urls[0], caption);
    return { ...primary, partialError: `album_fallback: ${partialError}` };
  }
}

async function waitIgContainer(containerId: string, token: string, maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const st = await graphGet(`/${containerId}?fields=status_code`, token);
    const code = String((st as any).status_code || "");
    if (code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram container status: ${code}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Instagram container timeout");
}

async function publishInstagram(
  igUserId: string,
  token: string,
  urls: string[],
  caption: string,
  mode: "primary" | "all",
): Promise<{ id: string }> {
  const list = urls.slice(0, 10);
  if (list.length === 0) throw new Error("No HTTPS image URLs for Instagram");

  if (mode === "primary" || list.length === 1) {
    const container = await graphForm(`/${igUserId}/media`, token, {
      image_url: list[0],
      caption,
    });
    const creationId = String(container.id || "");
    if (!creationId) throw new Error("Instagram media container missing id");
    await waitIgContainer(creationId, token);
    const pub = await graphForm(`/${igUserId}/media_publish`, token, {
      creation_id: creationId,
    });
    return { id: String(pub.id || "") };
  }

  const children: string[] = [];
  for (const u of list) {
    const child = await graphForm(`/${igUserId}/media`, token, {
      image_url: u,
      is_carousel_item: true,
    });
    if (child.id) children.push(String(child.id));
  }
  if (children.length < 2) {
    return publishInstagram(igUserId, token, [list[0]], caption, "primary");
  }

  const carousel = await graphForm(`/${igUserId}/media`, token, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
  });
  const creationId = String(carousel.id || "");
  if (!creationId) throw new Error("Instagram carousel container missing id");
  await waitIgContainer(creationId, token);
  const pub = await graphForm(`/${igUserId}/media_publish`, token, {
    creation_id: creationId,
  });
  return { id: String(pub.id || "") };
}

async function authorize(req: Request, admin: ReturnType<typeof createClient>): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const cronHeader = req.headers.get("x-cron-secret") || "";
  const cronSecret = Deno.env.get("SOCIAL_PUBLISH_CRON_SECRET") || "";

  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  // Cron / automation path
  if (cronSecret && (bearer === cronSecret || cronHeader === cronSecret)) {
    return null;
  }

  if (!bearer) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Reject accidental use of service role as "user" from browser (still allow if equals cron — handled above)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceKey && bearer === serviceKey) {
    // Service role only allowed when used as cron substitute if no dedicated secret
    if (!cronSecret) return null;
    return json({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${bearer}` } } },
  );
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  const { data: isManager } = await admin.rpc("has_role", { _user_id: user.id, _role: "manager" });
  if (!isAdmin && !isManager) {
    return json({ error: "Admin or manager role required" }, 403);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const enabled = (Deno.env.get("SOCIAL_PUBLISH_ENABLED") || "true").toLowerCase() !== "false";
    if (!enabled) {
      return json({ processed: 0, message: "SOCIAL_PUBLISH_ENABLED=false" });
    }

    const pageId = Deno.env.get("META_PAGE_ID") || "";
    const token = Deno.env.get("META_PAGE_ACCESS_TOKEN") || "";
    const igUserId = Deno.env.get("META_IG_BUSINESS_ID") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const denied = await authorize(req, supabase);
    if (denied) return denied;

    // Fail fast if META_PAGE_ACCESS_TOKEN is a User token (Meta then returns misleading publish_actions)
    if (pageId && token) {
      try {
        const me = await graphGet("/me?fields=id,name", token);
        const meId = String((me as { id?: string }).id || "");
        if (meId && meId !== pageId) {
          return json({
            error:
              `META_PAGE_ACCESS_TOKEN is not a Page token (token /me id=${meId}, expected Page ${pageId}). ` +
              "Use access_token from GET /me/accounts for that Page.",
            processed: 0,
          }, 400);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({
          error: `META_PAGE_ACCESS_TOKEN rejected by Meta: ${msg}`,
          processed: 0,
        }, 400);
      }
    }

    // Reclaim stale processing jobs
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
    await supabase
      .from("social_post_jobs")
      .update({
        status: "pending",
        last_error: "Reclaimed from stale processing",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "processing")
      .lt("updated_at", staleBefore);

    let onlyIds: string[] | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (Array.isArray(body?.job_ids)) onlyIds = body.job_ids.map(String);
      } catch {
        /* empty body ok */
      }
    }

    let q = supabase
      .from("social_post_jobs")
      .select("id, product_id, platform, status, image_mode, caption_snapshot, image_urls, attempts")
      .eq("status", "pending")
      .order("platform", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (onlyIds?.length) {
      q = q.in("id", onlyIds);
    }

    const { data: jobs, error } = await q;
    if (error) throw error;

    const sorted = ((jobs || []) as Job[]).sort((a, b) => {
      if (a.platform === b.platform) return 0;
      return a.platform === "facebook" ? -1 : 1;
    });

    const results: { id: string; platform: string; ok: boolean; error?: string }[] = [];

    for (const job of sorted) {
      // Atomic claim
      const { data: claimed, error: claimErr } = await supabase
        .from("social_post_jobs")
        .update({
          status: "processing",
          attempts: (job.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "pending")
        .select("id, attempts")
        .maybeSingle();

      if (claimErr || !claimed) {
        results.push({ id: job.id, platform: job.platform, ok: false, error: "claim_skipped" });
        continue;
      }

      const attemptNo = claimed.attempts ?? (job.attempts || 0) + 1;

      try {
        // Skip if product no longer published
        const { data: prod } = await supabase
          .from("products")
          .select("publish_status")
          .eq("id", job.product_id)
          .maybeSingle();
        if (!prod || prod.publish_status !== "published") {
          await supabase
            .from("social_post_jobs")
            .update({
              status: "skipped",
              last_error: "Product not published — skipped",
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          results.push({ id: job.id, platform: job.platform, ok: true, error: "skipped_unpublished" });
          continue;
        }

        const urls = asUrlList(job.image_urls);
        const caption = (job.caption_snapshot || "").trim();
        if (urls.length === 0) throw new Error("No HTTPS image_urls on job");
        if (!caption) throw new Error("Empty caption_snapshot");

        const { data: setting } = await supabase
          .from("social_post_settings")
          .select("is_enabled")
          .eq("platform", job.platform)
          .maybeSingle();
        if (setting && setting.is_enabled === false) {
          await supabase
            .from("social_post_jobs")
            .update({
              status: "skipped",
              last_error: "Platform disabled in social_post_settings",
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          results.push({ id: job.id, platform: job.platform, ok: true, error: "skipped" });
          continue;
        }

        if (job.platform === "facebook") {
          if (!pageId || !token) throw new Error("Missing META_PAGE_ID or META_PAGE_ACCESS_TOKEN");
          const out =
            job.image_mode === "all" && urls.length > 1
              ? await publishFacebookAlbum(pageId, token, urls, caption)
              : await publishFacebookPrimary(pageId, token, urls[0], caption);
          await supabase
            .from("social_post_jobs")
            .update({
              status: "posted",
              external_post_id: out.id,
              external_permalink: out.permalink || null,
              posted_at: new Date().toISOString(),
              last_error: out.partialError || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          results.push({
            id: job.id,
            platform: "facebook",
            ok: true,
            error: out.partialError,
          });
        } else {
          if (!igUserId || !token) throw new Error("Missing META_IG_BUSINESS_ID or META_PAGE_ACCESS_TOKEN");
          const out = await publishInstagram(igUserId, token, urls, caption, job.image_mode);
          await supabase
            .from("social_post_jobs")
            .update({
              status: "posted",
              external_post_id: out.id,
              posted_at: new Date().toISOString(),
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          results.push({ id: job.id, platform: "instagram", ok: true });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const terminal = attemptNo >= MAX_ATTEMPTS;
        await supabase
          .from("social_post_jobs")
          .update({
            status: terminal ? "failed" : "pending",
            last_error: msg.slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        results.push({ id: job.id, platform: job.platform, ok: false, error: msg });
      }
    }

    return json({
      processed: results.length,
      results,
      secrets_configured: {
        page: Boolean(pageId && token),
        instagram: Boolean(igUserId && token),
      },
    });
  } catch (err) {
    console.error("publish-social-product fatal:", err instanceof Error ? err.message : err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
