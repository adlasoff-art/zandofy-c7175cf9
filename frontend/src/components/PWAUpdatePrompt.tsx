import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { APP_VERSION, SHOW_UPDATE_PROMPT } from "@/version";

const PWA_UPDATE_LOCK_KEY = "pwa-update-lock";
const PWA_UPDATE_DONE_KEY = "pwa-update-done";
const PWA_UPDATE_DEFERRED_KEY = "pwa-update-deferred-checkout";

const clearAllCaches = async () => {
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
};

const isCheckoutPath = () => {
  try {
    return window.location.pathname.startsWith("/checkout");
  } catch {
    return false;
  }
};

/**
 * Hard-refresh modal when SHOW_UPDATE_PROMPT is true.
 * Deferred on /checkout until the user leaves checkout (prevents mid-payment reload).
 * Non-dismissible until the user taps « Mettre à jour ».
 */
export function PWAUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);
  const { locale } = useI18n();

  useEffect(() => {
    if (!SHOW_UPDATE_PROMPT) return;
    if (localStorage.getItem(PWA_UPDATE_DONE_KEY) === APP_VERSION) return;

    const tryShow = (reg: ServiceWorkerRegistration) => {
      if (localStorage.getItem(PWA_UPDATE_DONE_KEY) === APP_VERSION) return;
      if (sessionStorage.getItem(PWA_UPDATE_LOCK_KEY) === APP_VERSION) return;
      if (isCheckoutPath()) {
        sessionStorage.setItem(PWA_UPDATE_DEFERRED_KEY, APP_VERSION);
        return;
      }
      setRegistration(reg);
    };

    const handler = (e: Event) => {
      const reg = (e as CustomEvent).detail?.registration as ServiceWorkerRegistration | undefined;
      if (reg) tryShow(reg);
    };

    window.addEventListener("sw-update-available", handler);

    // After leaving checkout, surface deferred update
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (sessionStorage.getItem(PWA_UPDATE_DEFERRED_KEY) !== APP_VERSION) return;
      if (isCheckoutPath()) return;
      void navigator.serviceWorker?.getRegistration().then((reg) => {
        if (reg?.waiting) {
          sessionStorage.removeItem(PWA_UPDATE_DEFERRED_KEY);
          tryShow(reg);
        }
      });
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);

    return () => {
      window.removeEventListener("sw-update-available", handler);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    if (updating) return;

    setUpdating(true);
    sessionStorage.setItem(PWA_UPDATE_LOCK_KEY, APP_VERSION);
    localStorage.setItem(PWA_UPDATE_DONE_KEY, APP_VERSION);
    sessionStorage.removeItem(PWA_UPDATE_DEFERRED_KEY);

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

    if (!waiting) {
      cleanupAndReload();
      return;
    }

    const onStateChange = () => {
      if (waiting.state === "activated") {
        waiting.removeEventListener("statechange", onStateChange);
        finalizeReload();
      }
    };
    waiting.addEventListener("statechange", onStateChange);

    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      finalizeReload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    registration.active?.postMessage({ type: "CLEAR_CACHES" });
    waiting.postMessage({ type: "SKIP_WAITING" });

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
          {updating ? (isFr ? "Mise à jour en cours…" : "Updating…") : isFr ? "Mettre à jour maintenant" : "Update now"}
        </button>
      </div>
    </div>
  );
}
