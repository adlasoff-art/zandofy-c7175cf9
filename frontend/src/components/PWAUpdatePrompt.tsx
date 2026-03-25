import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

const APP_VERSION = "1.8.2";
const PWA_UPDATE_LOCK_KEY = "pwa-update-lock";
const PWA_UPDATE_DONE_KEY = "pwa-update-done";

const clearAllCaches = async () => {
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
};

export function PWAUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);
  const { locale } = useI18n();

  useEffect(() => {
    // If we already completed an update for this version, never show again
    if (localStorage.getItem(PWA_UPDATE_DONE_KEY) === APP_VERSION) return;

    const handler = (e: Event) => {
      if (localStorage.getItem(PWA_UPDATE_DONE_KEY) === APP_VERSION) return;
      if (sessionStorage.getItem(PWA_UPDATE_LOCK_KEY) === APP_VERSION) return;
      setRegistration((e as CustomEvent).detail.registration);
    };
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  const handleUpdate = useCallback(() => {
    if (updating) return;

    setUpdating(true);
    sessionStorage.setItem(PWA_UPDATE_LOCK_KEY, APP_VERSION);
    localStorage.setItem(PWA_UPDATE_DONE_KEY, APP_VERSION);

    const waiting = registration?.waiting;
    let reloadTriggered = false;

    const finalizeReload = () => {
      if (reloadTriggered) return;
      reloadTriggered = true;
      setRegistration(null);
      window.location.reload();
    };

    const cleanupAndReload = async () => {
      try {
        registration?.active?.postMessage({ type: "CLEAR_CACHES" });
        waiting?.postMessage({ type: "CLEAR_CACHES" });
        await clearAllCaches();
      } finally {
        finalizeReload();
      }
    };

    // If there's no waiting worker, force reload as fallback
    if (!waiting) {
      cleanupAndReload();
      return;
    }

    // Listen for the new SW to activate
    const onStateChange = () => {
      if (waiting.state === "activated") {
        waiting.removeEventListener("statechange", onStateChange);
        finalizeReload();
      }
    };
    waiting.addEventListener("statechange", onStateChange);

    // Also listen for controllerchange as a more reliable signal
    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      finalizeReload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    registration.active?.postMessage({ type: "CLEAR_CACHES" });

    // Tell the waiting SW to skip waiting
    waiting.postMessage({ type: "SKIP_WAITING" });

    // Safety timeout: if nothing happens after 4s, force reload
    setTimeout(() => {
      waiting.removeEventListener("statechange", onStateChange);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      cleanupAndReload();
    }, 4000);
  }, [registration, updating]);

  useEffect(() => {
    if (!registration?.waiting) {
      setRegistration(null);
      if (!updating) setUpdating(false);
    }
  }, [registration, updating]);

  if (!registration) return null;

  const isFr = locale === "fr";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-background border border-border p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          {updating ? (
            <Loader2 className="h-7 w-7 text-primary animate-spin" />
          ) : (
            <RefreshCw className="h-7 w-7 text-primary" />
          )}
        </div>

        <h2 className="text-lg font-bold text-foreground">
          {isFr ? "Nouvelle version disponible !" : "New version available!"}
        </h2>

        <p className="text-xs font-medium text-primary">v{APP_VERSION}</p>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {isFr
            ? "Mettez à jour pour profiter des nouvelles fonctionnalités et corrections."
            : "Update now to enjoy new features and improvements."}
        </p>

        <button
          onClick={handleUpdate}
          disabled={updating}
          className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98] touch-manipulation disabled:opacity-60"
        >
          {updating ? (isFr ? "Mise à jour en cours…" : "Updating…") : isFr ? "Mettre à jour" : "Update now"}
        </button>
      </div>
    </div>
  );
}
