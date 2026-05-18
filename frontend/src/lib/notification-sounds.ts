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

/** Play a soft "negative" tone for payment/order failures.
 *  Two short descending tones — distinct from the success chime so vendors and
 *  admins can immediately tell apart a real order from a failed payment.
 */
export function playFailureSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two descending notes: low to lower
    [380, 260].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.35);
    });
  } catch (e) {
    console.warn("Could not play failure sound:", e);
  }
}

/** Play a bright Shopify-style "ka-ching" bell — a satisfying cash-register chime */
export function playOrderAlertSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // --- Layer 1: Bright bell strike (two harmonics) ---
    const bellNotes = [
      { freq: 2637, start: 0, dur: 0.6, vol: 0.18 },      // E7 — sharp attack
      { freq: 3520, start: 0.005, dur: 0.5, vol: 0.10 },   // A7 — shimmer overtone
    ];

    bellNotes.forEach(({ freq, start, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });

    // --- Layer 2: "Ka-ching" coin trill (3 fast ascending tones) ---
    const trill = [
      { freq: 1318, delay: 0.08 },  // E6
      { freq: 1568, delay: 0.15 },  // G6
      { freq: 2093, delay: 0.22 },  // C7
    ];

    trill.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.13, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.3);
    });

    // --- Layer 3: Subtle high sparkle (sells the "bell" feel) ---
    const sparkle = ctx.createOscillator();
    const sparkleGain = ctx.createGain();
    sparkle.type = "sine";
    sparkle.frequency.value = 4186; // C8 — very high shimmer
    sparkleGain.gain.setValueAtTime(0.04, now + 0.1);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    sparkle.connect(sparkleGain);
    sparkleGain.connect(ctx.destination);
    sparkle.start(now + 0.1);
    sparkle.stop(now + 0.75);
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
