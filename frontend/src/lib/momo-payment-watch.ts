/**
 * Hybrid MoMo payment watcher — pattern from ShippingPaymentModal:
 * - Poll payment_transactions every 4s (webhook may already have updated)
 * - Every 3rd tick, also call kelpay-check (~12s; ~8s if first tick is immediate)
 * - finalizeOnce mutex so Realtime + poll + manual check cannot double-confirm
 *
 * Does NOT mark timeout/failed by itself — Checkout UI (180s panel + abandon) owns that.
 *
 * Note: payment_transactions was removed from supabase_realtime publication
 * (migration 20260409080052). Realtime subscribe is best-effort; this poll is
 * the reliable confirmation path.
 */
import { supabase } from "@/integrations/supabase/client";

export type MoMoWatchTerminal = "success" | "failed";

export type StartMoMoPaymentWatchOptions = {
  reference: string;
  transactionId?: string | null;
  onSuccess: () => void | Promise<void>;
  onFailed: () => void | Promise<void>;
  /** Poll interval (default 4000). */
  intervalMs?: number;
  /** Invoke kelpay-check every N ticks (default 3 → ~8–12s with immediate first tick). */
  kelpayEveryN?: number;
  /**
   * Stop polling after this many ticks without calling onFailed.
   * Default 50 (~200s) — covers the 180s USSD window + grace.
   */
  maxAttempts?: number;
};

export type MoMoPaymentWatchHandle = {
  /** Stops polling and marks settled so in-flight ticks cannot emit. */
  stop: () => void;
  /** Returns true only for the first terminal claim (Realtime / poll / manual). */
  claimResult: (status: MoMoWatchTerminal) => boolean;
  isSettled: () => boolean;
};

export function startMoMoPaymentWatch(
  options: StartMoMoPaymentWatchOptions,
): MoMoPaymentWatchHandle {
  const {
    reference,
    transactionId = null,
    onSuccess,
    onFailed,
    intervalMs = 4000,
    kelpayEveryN = 3,
    maxAttempts = 50,
  } = options;

  let settled = false;
  let attempts = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  const stop = () => {
    // Always settle on external stop so cancel/abandon/retry cannot race with emit()
    settled = true;
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const claimResult = (status: MoMoWatchTerminal): boolean => {
    if (settled) return false;
    settled = true;
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    return true;
  };

  const emit = async (status: MoMoWatchTerminal) => {
    if (!claimResult(status)) return;
    try {
      if (status === "success") await onSuccess();
      else await onFailed();
    } catch (e) {
      console.warn("[momo-watch] handler error:", e);
    }
  };

  const tick = async () => {
    if (settled || inFlight) return;
    attempts += 1;
    if (attempts > maxAttempts) {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return;
    }

    inFlight = true;
    try {
      const { data: txData } = await (supabase as any)
        .from("payment_transactions")
        .select("status")
        .eq("reference", reference)
        .maybeSingle();

      if (txData?.status === "success") {
        await emit("success");
        return;
      }
      if (txData?.status === "failed") {
        await emit("failed");
        return;
      }

      if (attempts % kelpayEveryN === 0) {
        const { data: checkData } = await supabase.functions.invoke("kelpay-check", {
          body: {
            reference,
            ...(transactionId ? { transaction_id: transactionId } : {}),
          },
        });
        if (checkData?.status === "success") {
          await emit("success");
          return;
        }
        if (checkData?.status === "failed") {
          await emit("failed");
          return;
        }
      }
    } catch {
      // silent retry — same as ShippingPaymentModal
    } finally {
      inFlight = false;
    }
  };

  // Immediate first DB poll (attempt 1) — webhook may already have written success
  void tick();
  intervalId = setInterval(() => {
    void tick();
  }, intervalMs);

  return {
    stop,
    claimResult,
    isSettled: () => settled,
  };
}
