import { useEffect, useRef } from "react";

/**
 * Lance `callback` à intervalle régulier en respectant la visibilité de l'onglet.
 *
 * - Quand le document est visible : appelle toutes les `activeMs` ms.
 * - Quand le document est caché : appelle toutes les `hiddenMs` ms (ou pas du tout si `hiddenMs` est 0).
 * - Re-déclenche immédiatement le callback au retour de focus.
 *
 * Conçu pour réduire la pression Disk IO côté Supabase quand de nombreux onglets/utilisateurs
 * laissent l'app ouverte en arrière-plan. Voir mem://architecture/cache-management-strategy.
 */
export function useVisibilityAwareInterval(
  callback: () => void | Promise<void>,
  opts: { activeMs: number; hiddenMs?: number; enabled?: boolean; runOnFocus?: boolean }
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const { activeMs, hiddenMs = 0, enabled = true, runOnFocus = true } = opts;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const schedule = () => {
      if (timer) clearInterval(timer);
      const hidden = typeof document !== "undefined" && document.hidden;
      const ms = hidden ? hiddenMs : activeMs;
      if (ms <= 0) return;
      timer = setInterval(() => {
        // Skip work entirely if the tab became hidden between ticks and hiddenMs is 0.
        if (document.hidden && hiddenMs <= 0) return;
        try {
          void cbRef.current();
        } catch {
          /* swallow — caller is responsible for its own error handling */
        }
      }, ms);
    };

    const onVisibility = () => {
      schedule();
      if (!document.hidden && runOnFocus) {
        try { void cbRef.current(); } catch { /* noop */ }
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [activeMs, hiddenMs, enabled, runOnFocus]);
}