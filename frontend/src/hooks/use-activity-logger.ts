/**
 * Hook for logging user activity events to user_activity_logs table.
 * Captures login, profile updates, searches, page views, etc.
 */
import { useCallback } from "react";
import { fromTable } from "@/lib/supabase-helpers";
import { useAuth } from "@/contexts/AuthContext";

export type ActivityAction =
  | "login"
  | "logout"
  | "profile_update"
  | "search"
  | "page_view"
  | "address_add"
  | "address_delete"
  | "payment_method_add"
  | "payment_method_delete"
  | "order_placed"
  | "order_cancelled"
  | "kyc_submitted"
  | "password_changed"
  | "settings_changed";

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = "other";
  if (/Edg/.test(ua)) browser = "edge";
  else if (/OPR|Opera/.test(ua)) browser = "opera";
  else if (/Chrome/.test(ua)) browser = "chrome";
  else if (/Safari/.test(ua)) browser = "safari";
  else if (/Firefox/.test(ua)) browser = "firefox";

  let os = "other";
  if (/iPad|iPhone|iPod/.test(ua)) os = "ios";
  else if (/Android/.test(ua)) os = "android";
  else if (/Windows/.test(ua)) os = "windows";
  else if (/Mac/.test(ua)) os = "macos";
  else if (/Linux/.test(ua)) os = "linux";

  const w = window.innerWidth;
  const device = w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";

  return { browser, os, device, screen_width: window.screen.width, screen_height: window.screen.height };
}

async function logActivity(
  userId: string,
  action: ActivityAction,
  metadata: Record<string, any> = {}
) {
  try {
    const deviceInfo = getDeviceInfo();
    await fromTable("user_activity_logs").insert({
      user_id: userId,
      action,
      metadata: {
        ...metadata,
        ...deviceInfo,
        page_path: window.location.pathname,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Silent fail — activity logging should never break the app
  }
}

export function useActivityLogger() {
  const { user } = useAuth();

  const log = useCallback(
    (action: ActivityAction, metadata: Record<string, any> = {}) => {
      if (!user?.id) return;
      void logActivity(user.id, action, metadata);
    },
    [user?.id]
  );

  return { log };
}

/** Standalone function for login events (called before hook is available) */
export function logLoginEvent(userId: string) {
  void logActivity(userId, "login");
}

/** Standalone function for logout events */
export function logLogoutEvent(userId: string) {
  void logActivity(userId, "logout");
}
