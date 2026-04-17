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

/** Fetch geo data once per session — shared cache key with use-geo-detection */
async function getGeoData(): Promise<{ country: string; city: string }> {
  // Check both cache keys for compatibility
  const cached = sessionStorage.getItem("zandofy_geo") || sessionStorage.getItem("z_geo");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return { country: parsed.country_name || parsed.country || "", city: parsed.city || "" };
    } catch { /* ignore */ }
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const geo = {
      country_code: data.country_code || "",
      country_name: data.country_name || "",
      city: data.city || "",
    };
    // Store under shared key so use-geo-detection can reuse it
    sessionStorage.setItem("zandofy_geo", JSON.stringify(geo));
    return { country: geo.country_name, city: geo.city };
  } catch {
    return { country: "", city: "" };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Internal geo cache — populated on first trackEvent call */
let _geoPromise: Promise<{ country: string; city: string }> | null = null;
function ensureGeo() {
  if (!_geoPromise) _geoPromise = getGeoData();
  return _geoPromise;
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

export function useAnalyticsTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const sessionStartRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string>("");
  const pageStartRef = useRef<number>(Date.now());

  useEffect(() => {
    sessionStartRef.current = Date.now();
    // Defer session_start to idle so it never blocks LCP/FCP
    deferToIdle(() => trackEvent("session_start", {}, user?.id));

    const handleBeforeUnload = () => {
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
      // Read geo from shared cache (synchronous — no async in beforeunload)
      let country: string | null = null;
      let city: string | null = null;
      try {
        const cached = sessionStorage.getItem("zandofy_geo");
        if (cached) {
          const geo = JSON.parse(cached);
          country = geo.country_name || geo.country || null;
          city = geo.city || null;
        }
      } catch { /* ignore */ }
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

      // Use fetch with keepalive instead of sendBeacon to include required headers
      try {
        fetch(url, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify(row),
        });
      } catch {
        // Last-resort silent fail
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user?.id]);

  useEffect(() => {
    const path = location.pathname;
    if (path === lastPathRef.current) return;

    if (lastPathRef.current) {
      const duration = Math.round((Date.now() - pageStartRef.current) / 1000);
      if (duration > 0) {
        const prevPath = lastPathRef.current;
        deferToIdle(() => trackEvent("page_view_end", {
          page_path: prevPath,
          duration_seconds: duration,
        }, user?.id));
      }
    }

    lastPathRef.current = path;
    pageStartRef.current = Date.now();

    const extra: Record<string, any> = {};
    const productMatch = path.match(/^\/product\/(.+)$/);
    const storeMatch = path.match(/^\/store\/(.+)$/);
    if (productMatch) extra.product_id = productMatch[1];
    if (storeMatch) extra.store_id = storeMatch[1];

    // Defer page_view to idle — frees the main thread for rendering
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
