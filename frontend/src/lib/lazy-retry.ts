import { lazy, type ComponentType } from "react";

const CHUNK_RELOAD_KEY = "chunk_reload_attempted";
const EB_AUTORECOVER_KEY = "eb_chunk_autorecover";

/** Clear recovery locks after a healthy boot so later navigations can recover again. */
export function clearChunkRecoveryLocks() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    sessionStorage.removeItem(EB_AUTORECOVER_KEY);
  } catch {
    /* ignore */
  }
}

async function nukeCaches() {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Lazy import with one shared recovery policy for post-deploy chunk mismatches.
 */
export function lazyRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    importFn().catch(async (error) => {
      const attempts = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
      if (attempts < 2) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1));
        await nukeCaches();
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }),
  );
}
