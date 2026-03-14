/**
 * Auth helpers — environment-aware OAuth + security utilities
 */
import { supabase } from "@/integrations/supabase/client";

// Lovable-managed domains where lovable.auth works
const LOVABLE_DOMAINS = [".lovable.app", ".lovableproject.com", "localhost"];

export function isLovableDomain(): boolean {
  const host = window.location.hostname;
  return LOVABLE_DOMAINS.some((d) => host.endsWith(d) || host === "localhost");
}

/**
 * Sign in with Google — auto-detects environment.
 * - On Lovable preview → uses lovable.auth.signInWithOAuth (managed credentials)
 * - On production (custom domain) → uses supabase.auth.signInWithOAuth (requires Google OAuth configured in Supabase)
 */
export async function signInWithGoogle(): Promise<{ error?: string }> {
  if (isLovableDomain()) {
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) return { error: String(result.error) };
      return {};
    } catch (e: any) {
      return { error: e.message || "Google sign-in failed" };
    }
  }

  // Production: use Supabase Auth directly
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) return { error: error.message };
  return {};
}

// ─── Login rate-limiting (client-side layer) ───────────────────────────────
const LOGIN_ATTEMPTS_KEY = "zandofy_login_attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

interface LoginAttempts {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

function getAttempts(): LoginAttempts {
  try {
    const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, firstAttempt: Date.now(), lockedUntil: null };
}

function saveAttempts(a: LoginAttempts) {
  sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(a));
}

export function checkRateLimit(): { allowed: boolean; remainingSeconds: number } {
  const a = getAttempts();
  if (a.lockedUntil && Date.now() < a.lockedUntil) {
    return { allowed: false, remainingSeconds: Math.ceil((a.lockedUntil - Date.now()) / 1000) };
  }
  // Reset if lockout expired
  if (a.lockedUntil && Date.now() >= a.lockedUntil) {
    saveAttempts({ count: 0, firstAttempt: Date.now(), lockedUntil: null });
  }
  return { allowed: true, remainingSeconds: 0 };
}

export function recordFailedLogin(): { locked: boolean; remainingSeconds: number } {
  const a = getAttempts();
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) {
    a.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
    saveAttempts(a);
    return { locked: true, remainingSeconds: LOCKOUT_MINUTES * 60 };
  }
  saveAttempts(a);
  return { locked: false, remainingSeconds: 0 };
}

export function resetLoginAttempts() {
  sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

// ─── Password strength checker ────────────────────────────────────────────
export function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Faible", color: "bg-destructive" };
  if (score <= 2) return { score, label: "Moyen", color: "bg-orange-500" };
  if (score <= 3) return { score, label: "Bon", color: "bg-yellow-500" };
  return { score, label: "Fort", color: "bg-green-500" };
}
