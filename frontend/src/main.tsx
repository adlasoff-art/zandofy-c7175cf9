import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { APP_VERSION, SHOW_UPDATE_PROMPT } from "./version";
import { clearChunkRecoveryLocks } from "./lib/lazy-retry";

// Remove static crawler home block once the SPA mounts (avoids duplicate H1 for humans).
document.getElementById("zandofy-seo-main")?.remove();

// Chunk load error detection & auto-reload
function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error as Error)?.message || String(error);
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("ChunkLoadError")
  );
}

function handleChunkReload(): void {
  const key = "chunk_reload_attempted";
  const attempts = Number(sessionStorage.getItem(key) || "0");
  if (attempts >= 2) return;
  sessionStorage.setItem(key, String(attempts + 1));

  if (attempts === 0) {
    window.location.reload();
    return;
  }

  (async () => {
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      /* ignore */
    }
    window.location.reload();
  })();
}

// Healthy boot: allow future recoveries in this tab
clearChunkRecoveryLocks();

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    handleChunkReload();
  }
});

window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.error) || (event.message && isChunkLoadError({ message: event.message }))) {
    event.preventDefault();
    handleChunkReload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

import("@/services/error-reporter").then(({ reportError }) => {
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error)) return;
    if (!event.error) return;
    reportError({ error: event.error });
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) return;
    const err = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    reportError({ error: err });
  });
});

// Register single PWA service worker (push handlers live in sw.js — do not register sw-push.js)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Retire legacy dual SW if still installed
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        if (url.includes("sw-push.js")) {
          void r.unregister();
        }
      });
    });

    const activateWaitingSilently = (registration: ServiceWorkerRegistration) => {
      const waiting = registration.waiting;
      if (!waiting || SHOW_UPDATE_PROMPT) return;
      waiting.postMessage({ type: "CLEAR_CACHES" });
      waiting.postMessage({ type: "SKIP_WAITING" });
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    };

    const dispatchUpdateAvailable = (registration: ServiceWorkerRegistration) => {
      const waitingWorker = registration.waiting;
      const activeController = navigator.serviceWorker.controller;

      if (!waitingWorker || !activeController) return;
      if (waitingWorker.scriptURL === activeController.scriptURL) return;

      if (!SHOW_UPDATE_PROMPT) {
        activateWaitingSilently(registration);
        return;
      }

      window.dispatchEvent(new CustomEvent("sw-update-available", { detail: { registration } }));
    };

    navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`).then((registration) => {
      const sendConfig = (sw: ServiceWorker | null) => {
        sw?.postMessage({
          type: "SW_CONFIG",
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        });
      };
      sendConfig(registration.active);
      if (registration.installing) {
        registration.installing.addEventListener("statechange", (e) => {
          if ((e.target as ServiceWorker).state === "activated") sendConfig(registration.active);
        });
      }

      dispatchUpdateAvailable(registration);

      setInterval(() => registration.update(), 30 * 60 * 1000);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            dispatchUpdateAvailable(registration);
          }
        });
      });
    }).catch(() => {});
  });
}
