import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export function PWAUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { locale } = useI18n();

  useEffect(() => {
    const handler = (e: Event) => {
      setRegistration((e as CustomEvent).detail.registration);
    };
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  const handleUpdate = useCallback(() => {
    const waiting = registration?.waiting;
    if (!waiting) return;

    waiting.addEventListener("statechange", () => {
      if (waiting.state === "activated") {
        window.location.reload();
      }
    });

    waiting.postMessage({ type: "SKIP_WAITING" });
  }, [registration]);

  if (!registration) return null;

  const isFr = locale === "fr";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-background border border-border p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <RefreshCw className="h-7 w-7 text-primary" />
        </div>

        <h2 className="text-lg font-bold text-foreground">
          {isFr ? "Nouvelle version disponible !" : "New version available!"}
        </h2>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {isFr
            ? "Mettez à jour pour profiter des nouvelles fonctionnalités et corrections."
            : "Update now to enjoy new features and improvements."}
        </p>

        <button
          onClick={handleUpdate}
          className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98] touch-manipulation"
        >
          {isFr ? "Mettre à jour" : "Update now"}
        </button>
      </div>
    </div>
  );
}
