/**
 * Captures error context and reports it to the error_reports table.
 * Works for both authenticated and unauthenticated users.
 */
import { supabase } from "@/integrations/supabase/client";

interface ErrorReport {
  error: Error;
  componentStack?: string;
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return ua.slice(0, 80);
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "Other";
}

function isPWA(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export async function reportError({ error, componentStack }: ErrorReport) {
  try {
    // Get current user info (may be null)
    const { data: { session } } = await supabase.auth.getSession();
    let userRole: string | null = null;

    if (session?.user) {
      const { data: roles } = await supabase.rpc("get_user_roles", {
        _user_id: session.user.id,
      });
      userRole = roles?.[0] ?? "client";
    }

    const payload = {
      user_id: session?.user?.id ?? null,
      // user_email is set server-side by trigger for security (prevents injection)
      user_role: userRole,
      error_message: error.message || String(error),
      error_stack: error.stack?.slice(0, 4000) ?? null,
      component_stack: componentStack?.slice(0, 4000) ?? null,
      page_path: window.location.pathname,
      browser: detectBrowser(),
      os: detectOS(),
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
      is_pwa: isPWA(),
      severity: "error",
    };

    await (supabase as any).from("error_reports").insert(payload);
  } catch (e) {
    // Silently fail — we don't want error reporting to cause more errors
    console.warn("[ErrorReporter] Failed to report error:", e);
  }
}
