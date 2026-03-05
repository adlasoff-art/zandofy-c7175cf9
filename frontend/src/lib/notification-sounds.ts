/**
 * Notification sound utilities using Web Audio API (no external files needed).
 * Generates simple tones programmatically.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Play a simple notification chime (two ascending tones) */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two quick ascending notes
    [520, 680].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.35);
    });
  } catch (e) {
    console.warn("Could not play notification sound:", e);
  }
}

/** Play a distinct order alert sound (three-tone "cash register" chime) */
export function playOrderAlertSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Three-tone ascending "ka-ching" pattern
    [880, 1100, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.45);
    });
  } catch (e) {
    console.warn("Could not play order alert sound:", e);
  }
}

/** Set the PWA app badge count. Falls back silently if unsupported. */
export async function setAppBadge(count: number) {
  try {
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
      } else {
        await (navigator as any).clearAppBadge();
      }
    }
  } catch (e) {
    // Silently ignore — not all browsers support this
  }
}
