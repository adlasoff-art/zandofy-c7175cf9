/**
 * Shared Web Push helper.
 *
 * Sends Web Push notifications to a set of users by fetching their active
 * `push_subscriptions`, signing VAPID, and POSTing to each browser endpoint
 * (FCM / APNs / Mozilla AutoPush).
 *
 * Dead subscriptions (404 / 410) are removed automatically.
 *
 * Requires env:
 *  - VAPID_PUBLIC_KEY
 *  - VAPID_PRIVATE_KEY
 *  - VAPID_SUBJECT (optional, defaults to mailto:noreply@zandofy.com)
 */
import * as webpush from "jsr:@negrel/webpush@0.5.0";

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  unreadCount?: number;
}

export interface SendWebPushOptions {
  userIds: string[];
  payload: WebPushPayload;
}

export interface SendWebPushResult {
  attempted: number;
  sent: number;
  removed: number;
  skipped: boolean;
  error?: string;
}

let cachedAppServer: any = null;

async function getAppServer() {
  if (cachedAppServer) return cachedAppServer;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@zandofy.com";
  if (!publicKey || !privateKey) return null;

  const vapidKeys = await webpush.importVapidKeys(
    { publicKey, privateKey },
    { extractable: false },
  );
  cachedAppServer = await webpush.ApplicationServer.new({
    contactInformation: subject,
    vapidKeys,
  });
  return cachedAppServer;
}

/**
 * Sends a Web Push notification to all active subscriptions of the given users.
 * Best-effort: errors per subscription are logged but never thrown.
 */
export async function sendWebPush(
  supabase: any,
  { userIds, payload }: SendWebPushOptions,
): Promise<SendWebPushResult> {
  if (!userIds?.length) {
    return { attempted: 0, sent: 0, removed: 0, skipped: true };
  }

  let appServer;
  try {
    appServer = await getAppServer();
  } catch (err) {
    console.error("[web-push] VAPID init failed:", err);
    return { attempted: 0, sent: 0, removed: 0, skipped: true, error: String(err) };
  }

  if (!appServer) {
    console.warn("[web-push] VAPID keys missing — skipping push send");
    return { attempted: 0, sent: 0, removed: 0, skipped: true, error: "vapid_missing" };
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (error) {
    console.error("[web-push] failed to load subscriptions:", error);
    return { attempted: 0, sent: 0, removed: 0, skipped: true, error: error.message };
  }

  const subscriptionList = Array.isArray(subs) ? subs : [];
  if (!subscriptionList.length) {
    return { attempted: 0, sent: 0, removed: 0, skipped: true };
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/dashboard",
    icon: payload.icon || "/icon-192x192.png",
    badge: payload.badge || "/icon-192x192.png",
    tag: payload.tag,
    requireInteraction: payload.requireInteraction === true,
    unreadCount: typeof payload.unreadCount === "number" ? payload.unreadCount : undefined,
  });

  let sent = 0;
  let removed = 0;
  const deadIds: string[] = [];

  await Promise.all(
    subscriptionList.map(async (row: any) => {
      if (!row?.endpoint || !row?.p256dh || !row?.auth) return;
      try {
        const subscriber = appServer.subscribe({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        });
        await subscriber.pushTextMessage(message, { ttl: 3600 });
        sent++;
      } catch (err: any) {
        const status = err?.statusCode ?? err?.status ?? 0;
        const msg = String(err?.message || err);
        // 404 / 410 = subscription expired or invalid → remove from DB
        if (status === 404 || status === 410 || /\b(404|410)\b/.test(msg)) {
          deadIds.push(row.id);
        } else {
          console.warn(
            "[web-push] send failed",
            row.endpoint?.slice(0, 60),
            status,
            msg,
          );
        }
      }
    }),
  );

  if (deadIds.length) {
    const { error: delErr } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", deadIds);
    if (delErr) console.warn("[web-push] cleanup failed:", delErr);
    else removed = deadIds.length;
  }

  return { attempted: subscriptionList.length, sent, removed, skipped: false };
}

/**
 * Convenience helper: send Web Push without throwing.
 * Always returns a result, never rejects.
 */
export async function sendWebPushSafe(
  supabase: any,
  opts: SendWebPushOptions,
): Promise<SendWebPushResult> {
  try {
    return await sendWebPush(supabase, opts);
  } catch (err) {
    console.error("[web-push] unexpected error:", err);
    return { attempted: 0, sent: 0, removed: 0, skipped: true, error: String(err) };
  }
}