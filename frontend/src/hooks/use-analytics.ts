import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function getSessionId(): string {
  let sid = sessionStorage.getItem("z_session_id");
  if (!sid) {
    sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem("z_session_id", sid);
  }
  return sid;
}

/** Persistent device identifier — survives session restarts */
function getDeviceId(): string {
  let did = localStorage.getItem("z_device_id");
  if (!did) {
    did = `d_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 12)}`;
    localStorage.setItem("z_device_id", did);
  }
  return did;
}

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function getOS(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Mac/.test(ua)) return "macos";
  if (/Linux/.test(ua)) return "linux";
  return "other";
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg/.test(ua)) return "edge";
  if (/OPR|Opera/.test(ua)) return "opera";
  if (/Chrome/.test(ua)) return "chrome";
  if (/Safari/.test(ua)) return "safari";
  if (/Firefox/.test(ua)) return "firefox";
  return "other";
}

function isPWA(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as any).standalone === true;
}

const UTM_STORAGE_KEY = "z_utm";
const HUMAN_FLAG_KEY = "z_human_session";
const BOT_UA =
  /(googlebot|bingbot|yandex|duckduckbot|baiduspider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|pinterest|embedly|redditbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|seznambot|bytespider|gptbot|claudebot|ccbot|amazonbot|headlesschrome|phantomjs|lighthouse|chrome-lighthouse|pingdom|uptimerobot|statuscake)/i;

function isBotUserAgent(): boolean {
  if (typeof navigator === "undefined") return true;
  return BOT_UA.test(navigator.userAgent || "");
}

const SOCIAL_HINTS = ["facebook", "instagram", "twitter", "t.co", "linkedin", "tiktok", "whatsapp", "t.me", "youtube", "snapchat", "pinterest", "fb.", "meta.com"];
const SEARCH_HINTS = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex."];

function isSelfHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.includes("zandofy.com") || h === "localhost" || h.startsWith("127.0.0.1");
}

function captureUtmAndSource(): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_referrer: string | null;
  source_class: string;
} {
  const params = new URLSearchParams(window.location.search);
  let utm_source = params.get("utm_source");
  let utm_medium = params.get("utm_medium");
  let utm_campaign = params.get("utm_campaign");
  let utm_content = params.get("utm_content");
  let utm_term = params.get("utm_term");

  if (utm_source || utm_medium || utm_campaign) {
    try {
      sessionStorage.setItem(
        UTM_STORAGE_KEY,
        JSON.stringify({ utm_source, utm_medium, utm_campaign, utm_content, utm_term })
      );
    } catch { /* ignore */ }
  } else {
    try {
      const cached = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        utm_source = parsed.utm_source ?? null;
        utm_medium = parsed.utm_medium ?? null;
        utm_campaign = parsed.utm_campaign ?? null;
        utm_content = parsed.utm_content ?? null;
        utm_term = parsed.utm_term ?? null;
      }
    } catch { /* ignore */ }
  }

  const landing_referrer = document.referrer || null;
  const refLower = (landing_referrer || "").toLowerCase();
  const utmBlob = `${utm_source || ""} ${utm_medium || ""}`.toLowerCase();

  let source_class = "direct";
  if (isPWA()) {
    source_class = "pwa";
  } else if (
    SOCIAL_HINTS.some((h) => utmBlob.includes(h) || refLower.includes(h)) ||
    utm_medium === "social" ||
    utm_medium === "social-media"
  ) {
    source_class = "social";
  } else if (
    SEARCH_HINTS.some((h) => refLower.includes(h)) ||
    utm_medium === "organic" ||
    utm_medium === "cpc" ||
    utm_medium === "seo"
  ) {
    source_class = "search";
  } else if (landing_referrer) {
    try {
      const host = new URL(landing_referrer).hostname;
      source_class = isSelfHost(host) ? "direct" : "referral";
    } catch {
      source_class = "referral";
    }
  }

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    landing_referrer,
    source_class,
  };
}

/**
 * Read geo from session cache, or hydrate once from /api/geo (CF-IPCountry).
 * Never invent "RD Congo" as a default for analytics.
 */
async function getGeoData(): Promise<{ country: string; city: string }> {
  const cached = sessionStorage.getItem("zandofy_geo") || sessionStorage.getItem("z_geo");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const country = parsed.country_name || parsed.country || "";
      // Ignore placeholder default CD with empty city from idle geo hook
      if (country && !(parsed.source === "default-cd")) {
        return { country, city: parsed.city || "" };
      }
      if (parsed.source === "cf" || parsed.source === "vercel") {
        return { country, city: parsed.city || "" };
      }
    } catch {
      /* fall through */
    }
  }

  try {
    if (sessionStorage.getItem("z_geo_fetching") === "1") {
      return { country: "", city: "" };
    }
    sessionStorage.setItem("z_geo_fetching", "1");
    const res = await fetch("/api/geo", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      if (data.country_code || data.country_name) {
        const geo = {
          country_code: data.country_code || "",
          country_name: data.country_name || data.country || "",
          country: data.country_name || data.country || "",
          city: data.city || "",
          source: data.source || "cf",
        };
        sessionStorage.setItem("zandofy_geo", JSON.stringify(geo));
        sessionStorage.setItem("z_geo", JSON.stringify(geo));
        return { country: geo.country_name, city: geo.city };
      }
    }
  } catch {
    /* ignore */
  } finally {
    try {
      sessionStorage.removeItem("z_geo_fetching");
    } catch {
      /* ignore */
    }
  }

  return { country: "", city: "" };
}

/** Always re-read from sessionStorage (cheap) so events emitted after
 *  use-geo-detection populated the cache get country/city, while early ones
 *  remain anonymous. */
function ensureGeo() {
  return getGeoData();
}

async function trackEvent(
  eventType: string,
  extra: Record<string, any> = {},
  userId?: string
) {
  const sessionId = getSessionId();
  const geo = await ensureGeo();
  const row: any = {
    session_id: sessionId,
    event_type: eventType,
    page_path: window.location.pathname,
    referrer: document.referrer || null,
    device_type: getDeviceType(),
    os: getOS(),
    browser: getBrowser(),
    is_pwa: isPWA(),
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    country: geo.country || null,
    city: geo.city || null,
    ...extra,
  };
  if (userId) row.user_id = userId;

  try {
    await fromTable("analytics_events").insert(row);
  } catch {
    // Silent fail
  }
}

/** Defer non-critical analytics work to idle time so it never blocks LCP/FCP. */
function deferToIdle(fn: () => void, timeout = 2000) {
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(fn, { timeout });
  } else {
    setTimeout(fn, 1);
  }
}

/** Public helper for search submits / trending clicks */
export function trackSearchQuery(query: string, userId?: string) {
  const q = query.trim();
  if (q.length < 2) return;
  deferToIdle(() => trackEvent("search", { metadata: { query: q } }, userId));
}

export function useAnalyticsTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const sessionStartRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string>("");
  const pageStartRef = useRef<number>(Date.now());
  const humanReadyRef = useRef(false);
  const sessionStartedRef = useRef(false);

  useEffect(() => {
    if (isBotUserAgent()) return;

    sessionStartRef.current = Date.now();

    const markHumanAndStart = () => {
      if (humanReadyRef.current) return;
      humanReadyRef.current = true;
      try {
        sessionStorage.setItem(HUMAN_FLAG_KEY, "1");
      } catch {
        /* ignore */
      }

      deferToIdle(() => {
        const acquisition = captureUtmAndSource();
        if (!sessionStartedRef.current) {
          sessionStartedRef.current = true;
          trackEvent(
            "session_start",
            {
              metadata: { ...acquisition, is_human: true },
              referrer: acquisition.landing_referrer || document.referrer || null,
            },
            user?.id,
          );
        }
        trackEvent(
          "human_session",
          {
            metadata: { ...acquisition, gate: "interaction" },
            referrer: acquisition.landing_referrer || document.referrer || null,
          },
          user?.id,
        );
        // First human page_view for the landing path
        const path = window.location.pathname;
        const extra: Record<string, any> = {};
        const productMatch = path.match(/^\/product\/(.+)$/);
        const storeMatch = path.match(/^\/store\/(.+)$/);
        if (productMatch) extra.product_id = productMatch[1];
        if (storeMatch) extra.store_id = storeMatch[1];
        trackEvent("page_view", extra, user?.id);
        if (storeMatch) {
          trackEvent("store_view", { store_id: storeMatch[1] }, user?.id);
        }
      });
    };

    // Resume human flag within the same tab session
    try {
      if (sessionStorage.getItem(HUMAN_FLAG_KEY) === "1") {
        markHumanAndStart();
      }
    } catch {
      /* ignore */
    }

    const onInteract = () => markHumanAndStart();
    const opts: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("pointerdown", onInteract, opts);
    window.addEventListener("keydown", onInteract, opts);
    window.addEventListener("scroll", onInteract, opts);
    window.addEventListener("touchstart", onInteract, opts);

    const handleBeforeUnload = () => {
      if (!humanReadyRef.current) return;
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
      let country: string | null = null;
      let city: string | null = null;
      try {
        const cached = sessionStorage.getItem("zandofy_geo");
        if (cached) {
          const geo = JSON.parse(cached);
          country = geo.country_name || geo.country || null;
          city = geo.city || null;
        }
      } catch {
        /* ignore */
      }
      const row: any = {
        session_id: getSessionId(),
        event_type: "session_end",
        page_path: window.location.pathname,
        device_type: getDeviceType(),
        os: getOS(),
        browser: getBrowser(),
        is_pwa: isPWA(),
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        duration_seconds: duration,
        country,
        city,
      };
      if (user?.id) row.user_id = user.id;

      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events`;

      try {
        fetch(url, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(row),
        });
      } catch {
        /* silent */
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user?.id]);

  useEffect(() => {
    if (isBotUserAgent()) return;

    const path = location.pathname;
    if (path === lastPathRef.current) return;

    if (lastPathRef.current && humanReadyRef.current) {
      const duration = Math.round((Date.now() - pageStartRef.current) / 1000);
      if (duration > 0) {
        const prevPath = lastPathRef.current;
        deferToIdle(() =>
          trackEvent(
            "page_view_end",
            {
              page_path: prevPath,
              duration_seconds: duration,
            },
            user?.id,
          ),
        );
      }
    }

    lastPathRef.current = path;
    pageStartRef.current = Date.now();

    // Page views only after human interaction (bots never pass the gate)
    if (!humanReadyRef.current && sessionStorage.getItem(HUMAN_FLAG_KEY) !== "1") {
      return;
    }

    const extra: Record<string, any> = {};
    const productMatch = path.match(/^\/product\/(.+)$/);
    const storeMatch = path.match(/^\/store\/(.+)$/);
    if (productMatch) extra.product_id = productMatch[1];
    if (storeMatch) extra.store_id = storeMatch[1];

    deferToIdle(() => trackEvent("page_view", extra, user?.id));

    if (storeMatch) {
      deferToIdle(() => trackEvent("store_view", { store_id: storeMatch[1] }, user?.id));
    }
  }, [location.pathname, user?.id]);
}

export function useTrackProductClick() {
  const { user } = useAuth();
  return useCallback(
    (productId: string, source?: string) => {
      trackEvent("product_click", {
        product_id: productId,
        metadata: { source: source || "grid" },
      }, user?.id);
    },
    [user?.id]
  );
}

export function useTrackStoreView() {
  const { user } = useAuth();
  return useCallback(
    (storeId: string) => {
      trackEvent("store_view", { store_id: storeId }, user?.id);
    },
    [user?.id]
  );
}

/**
 * Track PWA install persistently — writes to both analytics_events AND pwa_installs table.
 * Uses device_id (localStorage) as unique key so one device = one install record.
 */
export function trackPWAInstall(userId?: string) {
  const deviceId = getDeviceId();
  
  trackEvent("pwa_install", {
    metadata: { standalone: isPWA(), os: getOS(), device: getDeviceType() },
  }, userId);

  try {
    supabase.from("pwa_installs" as any).upsert({
      device_id: deviceId,
      session_id: getSessionId(),
      user_id: userId || null,
      device_type: getDeviceType(),
      os: getOS(),
      browser: getBrowser(),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "device_id" }).then(() => {});
  } catch {
    // Silent fail
  }
}

/**
 * Track PWA presence on every session start (for accurate active PWA user counts).
 * Updates last_seen_at so we can distinguish active vs dormant installs.
 */
export function trackPWAPresence(userId?: string) {
  if (!isPWA()) return;
  
  const deviceId = getDeviceId();
  try {
    supabase.from("pwa_installs" as any).upsert({
      device_id: deviceId,
      session_id: getSessionId(),
      user_id: userId || null,
      device_type: getDeviceType(),
      os: getOS(),
      browser: getBrowser(),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "device_id" }).then(() => {});
  } catch {
    // Silent fail
  }
}
