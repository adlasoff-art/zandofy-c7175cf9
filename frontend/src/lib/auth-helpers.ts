/**
 * Auth helpers — environment-aware OAuth + security utilities
 * Server-side rate limiting via failed_login_attempts table
 * Progressive password reset cooldowns via password_reset_tracker table
 */
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";

// Lovable-managed domains where lovable.auth works
const LOVABLE_DOMAINS = [".lovable.app", ".lovableproject.com", "localhost"];

export function isLovableDomain(): boolean {
  const host = window.location.hostname;
  return LOVABLE_DOMAINS.some((d) => host.endsWith(d) || host === "localhost");
}

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

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) return { error: error.message };
  return {};
}

// ─── Login rate-limiting (server-side + client fallback) ─────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 60; // 1 hour lockout

// Client-side fallback (always works, even without DB tables)
const LOGIN_ATTEMPTS_KEY = "zandofy_login_attempts";

interface LoginAttempts {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

function getLocalAttempts(): LoginAttempts {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, firstAttempt: Date.now(), lockedUntil: null };
}

function saveLocalAttempts(a: LoginAttempts) {
  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(a));
}

export function checkRateLimit(): { allowed: boolean; remainingSeconds: number; attemptsLeft: number } {
  const a = getLocalAttempts();
  if (a.lockedUntil && Date.now() < a.lockedUntil) {
    return { allowed: false, remainingSeconds: Math.ceil((a.lockedUntil - Date.now()) / 1000), attemptsLeft: 0 };
  }
  if (a.lockedUntil && Date.now() >= a.lockedUntil) {
    saveLocalAttempts({ count: 0, firstAttempt: Date.now(), lockedUntil: null });
    return { allowed: true, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS };
  }
  return { allowed: true, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS - a.count };
}

export function recordFailedLogin(): { locked: boolean; remainingSeconds: number; attemptsLeft: number } {
  const a = getLocalAttempts();
  a.count += 1;
  const attemptsLeft = MAX_ATTEMPTS - a.count;

  if (a.count >= MAX_ATTEMPTS) {
    a.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
    saveLocalAttempts(a);

    // Also record server-side (fire-and-forget)
    try {
      fromTable("failed_login_attempts").insert({
        email: "unknown", // will be set by caller
        attempt_count: a.count,
        locked_until: new Date(a.lockedUntil).toISOString(),
      }).then(() => {});
    } catch {}

    return { locked: true, remainingSeconds: LOCKOUT_MINUTES * 60, attemptsLeft: 0 };
  }

  saveLocalAttempts(a);
  return { locked: false, remainingSeconds: 0, attemptsLeft };
}

export function recordFailedLoginWithEmail(email: string): { locked: boolean; remainingSeconds: number; attemptsLeft: number } {
  const result = recordFailedLogin();

  // Update server-side with email
  try {
    fromTable("failed_login_attempts").upsert({
      email: email.toLowerCase().trim(),
      attempt_count: getLocalAttempts().count,
      last_attempt_at: new Date().toISOString(),
      locked_until: result.locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString() : null,
    }, { onConflict: "email" }).then(() => {});
  } catch {}

  return result;
}

export function resetLoginAttempts() {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

// ─── Password Reset Rate Limiting ────────────────────────────────────────
const RESET_TRACKER_KEY = "zandofy_reset_tracker";
const MAX_RESETS_PER_DAY = 2;

interface ResetTracker {
  count: number;
  lastResetDate: string; // YYYY-MM-DD
  consecutiveResets: number;
  nextAllowed: number | null; // timestamp
}

function getResetTracker(): ResetTracker {
  try {
    const raw = localStorage.getItem(RESET_TRACKER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastResetDate: "", consecutiveResets: 0, nextAllowed: null };
}

function saveResetTracker(t: ResetTracker) {
  localStorage.setItem(RESET_TRACKER_KEY, JSON.stringify(t));
}

export function checkResetAllowed(): { allowed: boolean; message: string } {
  const t = getResetTracker();
  const today = new Date().toISOString().slice(0, 10);

  // Check if we're still in a cooldown period
  if (t.nextAllowed && Date.now() < t.nextAllowed) {
    const diff = t.nextAllowed - Date.now();
    const days = Math.ceil(diff / (86400 * 1000));
    if (days > 7) {
      return { allowed: false, message: `Quota de réinitialisation atteint. Réessayez dans ${days} jours.` };
    }
    if (days > 1) {
      return { allowed: false, message: `Quota de réinitialisation atteint. Réessayez dans ${days} jours.` };
    }
    const hours = Math.ceil(diff / (3600 * 1000));
    return { allowed: false, message: `Quota de réinitialisation atteint. Réessayez dans ${hours} heure(s).` };
  }

  // Reset daily count if it's a new day
  if (t.lastResetDate !== today) {
    // Don't reset consecutive count — it persists across days
    return { allowed: true, message: "" };
  }

  // Check daily limit
  if (t.count >= MAX_RESETS_PER_DAY) {
    return { allowed: false, message: `Vous avez atteint la limite de ${MAX_RESETS_PER_DAY} réinitialisations par jour.` };
  }

  return { allowed: true, message: "" };
}

export function recordPasswordReset() {
  const t = getResetTracker();
  const today = new Date().toISOString().slice(0, 10);

  if (t.lastResetDate !== today) {
    t.count = 1;
    t.lastResetDate = today;
  } else {
    t.count += 1;
  }

  t.consecutiveResets += 1;

  // Progressive cooldowns:
  // After 2nd reset in a day: wait 1 week
  // After 3rd consecutive: wait 1 month
  if (t.count >= MAX_RESETS_PER_DAY) {
    if (t.consecutiveResets >= 4) {
      // After multiple consecutive resets: 1 month cooldown
      t.nextAllowed = Date.now() + 30 * 86400 * 1000;
    } else if (t.consecutiveResets >= 2) {
      // After 2nd daily reset: 1 week cooldown
      t.nextAllowed = Date.now() + 7 * 86400 * 1000;
    }
  }

  saveResetTracker(t);
}

export function getResetsRemaining(): number {
  const t = getResetTracker();
  const today = new Date().toISOString().slice(0, 10);
  if (t.lastResetDate !== today) return MAX_RESETS_PER_DAY;
  return Math.max(0, MAX_RESETS_PER_DAY - t.count);
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
