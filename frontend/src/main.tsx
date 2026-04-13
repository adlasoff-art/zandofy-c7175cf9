import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Chunk load error detection & auto-reload
function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error as Error)?.message || String(error);
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("Importing a module script failed")
  );
}

function handleChunkReload(): void {
  const key = "chunk_reload_attempted";
  if (sessionStorage.getItem(key)) return; // already tried once
  sessionStorage.setItem(key, "1");
  window.location.reload();
}

// Clear the flag on successful load so future deploys can retry
sessionStorage.removeItem("chunk_reload_attempted");

// Catch unhandled promise rejections from lazy imports
window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    handleChunkReload();
  }
});

// Catch synchronous chunk errors
window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.error) || (event.message && isChunkLoadError({ message: event.message }))) {
    event.preventDefault();
    handleChunkReload();
  }
});

// Zandofy deploy proof — 2026-04-13T03:10Z
createRoot(document.getElementById("root")!).render(<App />);

// ─── Global error reporting (non-React errors) ──────────────────
import("@/services/error-reporter").then(({ reportError }) => {
  // Catch unhandled JS errors that are NOT chunk-load errors
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error)) return; // already handled above
    if (!event.error) return;
    reportError({ error: event.error });
  });

  // Catch unhandled promise rejections that are NOT chunk-load errors
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) return; // already handled above
    const err = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    reportError({ error: err });
  });
});

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const dispatchUpdateAvailable = (registration: ServiceWorkerRegistration) => {
      const waitingWorker = registration.waiting;
      const activeController = navigator.serviceWorker.controller;

      if (!waitingWorker || !activeController) return;
      if (waitingWorker.scriptURL === activeController.scriptURL) return;

      window.dispatchEvent(new CustomEvent("sw-update-available", { detail: { registration } }));
    };

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Send Supabase config to SW so it doesn't need hardcoded keys
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

      // Check for updates periodically (every 30 min)
      setInterval(() => registration.update(), 30 * 60 * 1000);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // New SW installed & there's already an active one → update available
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            dispatchUpdateAvailable(registration);
          }
        });
      });
    }).catch(() => {});
  });
}
