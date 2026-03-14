import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { fromTable } from "@/lib/supabase-helpers";
import { useAuth } from "@/contexts/AuthContext";

function getSessionId(): string {
  let sid = sessionStorage.getItem("z_session_id");
  if (!sid) {
    sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem("z_session_id", sid);
  }
  return sid;
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

async function trackEvent(
  eventType: string,
  extra: Record<string, any> = {},
  userId?: string
) {
  const sessionId = getSessionId();
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
    ...extra,
  };
  if (userId) row.user_id = userId;

  try {
    await fromTable("analytics_events").insert(row);
  } catch {
    // Silent fail
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
    trackEvent("session_start", {}, user?.id);

    const handleBeforeUnload = () => {
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
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
      };
      if (user?.id) row.user_id = user.id;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };
      navigator.sendBeacon(
        url + "?" + new URLSearchParams({ apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }).toString(),
        new Blob([JSON.stringify(row)], { type: "application/json" })
      );
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
        trackEvent("page_view_end", {
          page_path: lastPathRef.current,
          duration_seconds: duration,
        }, user?.id);
      }
    }

    lastPathRef.current = path;
    pageStartRef.current = Date.now();

    const extra: Record<string, any> = {};
    const productMatch = path.match(/^\/product\/(.+)$/);
    const storeMatch = path.match(/^\/store\/(.+)$/);
    if (productMatch) extra.product_id = productMatch[1];
    if (storeMatch) extra.store_id = storeMatch[1];

    trackEvent("page_view", extra, user?.id);
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

export function trackPWAInstall(userId?: string) {
  trackEvent("pwa_install", {
    metadata: { standalone: isPWA(), os: getOS(), device: getDeviceType() },
  }, userId);
}
