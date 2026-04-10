import { useState, useEffect, useRef } from "react";
import { X, Download, MoreVertical } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("pwa_banner_dismissed") === "1");
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [showAndroidFallback, setShowAndroidFallback] = useState(false);
  const { locale } = useI18n();

  useEffect(() => {
    if (isInStandaloneMode()) {
      setIsInstalled(true);
      return;
    }

    if (isIOS()) {
      setShowIOSBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(prompt);
      deferredPromptRef.current = prompt;
      setShowAndroidFallback(false);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Listen for successful install
    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      deferredPromptRef.current = null;
    };
    window.addEventListener("appinstalled", installedHandler);

    // Android fallback: if beforeinstallprompt doesn't fire within 3s
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (isAndroid()) {
      fallbackTimer = setTimeout(() => {
        if (!deferredPromptRef.current) {
          setShowAndroidFallback(true);
        }
      }, 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current || deferredPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
    deferredPromptRef.current = null;
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa_banner_dismissed", "1");
  };

  if (isInstalled || dismissed) return null;

  const isFr = locale === "fr";

  // iOS banner
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-16 inset-x-0 z-[60] px-3 pb-2 lg:hidden animate-fade-in">
        <div className="relative bg-primary text-primary-foreground rounded-xl px-4 py-3 shadow-lg">
          <button
            onClick={handleDismiss}
            className="absolute top-2.5 right-2.5 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors touch-manipulation"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <p className="text-sm font-bold mb-2 pr-6">
            {isFr ? "Installer Zandofy" : "Install Zandofy"}
          </p>
          <div className="space-y-1.5 text-xs leading-relaxed opacity-95">
            <p className="flex items-center gap-1.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold">1</span>
              {isFr ? "Appuyez sur" : "Tap"}{" "}
              <span className="inline-flex items-center gap-1 bg-primary-foreground/25 rounded px-1.5 py-0.5 font-semibold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Partager
              </span>
              {isFr ? " en bas" : " at bottom"}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold">2</span>
              {isFr ? "Choisissez « Sur l'écran d'accueil »" : "Choose \"Add to Home Screen\""}
              {" "}
              <span className="inline-flex items-center bg-primary-foreground/25 rounded px-1.5 py-0.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold">3</span>
              {isFr ? "Appuyez « Ajouter »" : "Tap \"Add\""}
            </p>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rotate-45" />
        </div>
      </div>
    );
  }

  // Android with native prompt
  if (deferredPrompt) {
    const label = isFr ? "Installer l'app Zandofy" : "Install Zandofy app";
    const cta = isFr ? "Installer" : "Install";

    return (
      <div className="fixed bottom-16 inset-x-0 z-[60] px-3 pb-2 lg:hidden animate-fade-in">
        <div className="flex items-center gap-3 bg-primary text-primary-foreground rounded-xl px-4 py-3 shadow-lg">
          <Download size={20} className="shrink-0" />
          <span className="text-sm font-medium flex-1">{label}</span>
          <button
            onClick={handleInstall}
            className="px-4 py-1.5 text-xs font-bold bg-primary-foreground text-primary rounded-full hover:opacity-90 transition-opacity touch-manipulation"
          >
            {cta}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-primary-foreground/20 transition-colors touch-manipulation"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Android fallback: manual instructions + Install button
  if (showAndroidFallback) {
    return (
      <div className="fixed bottom-16 inset-x-0 z-[60] px-3 pb-2 lg:hidden animate-fade-in">
        <div className="relative bg-primary text-primary-foreground rounded-xl px-4 py-3 shadow-lg">
          <button
            onClick={handleDismiss}
            className="absolute top-2.5 right-2.5 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors touch-manipulation"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <p className="text-sm font-bold mb-2 pr-6">
            {isFr ? "Installer Zandofy" : "Install Zandofy"}
          </p>
          <div className="space-y-1.5 text-xs leading-relaxed opacity-95">
            <p className="flex items-center gap-1.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold">1</span>
              {isFr ? "Appuyez sur" : "Tap"}{" "}
              <span className="inline-flex items-center gap-1 bg-primary-foreground/25 rounded px-1.5 py-0.5 font-semibold">
                <MoreVertical size={14} />
                Menu
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold">2</span>
              {isFr ? "Choisissez « Ajouter à l'écran d'accueil »" : "Choose \"Add to Home Screen\""}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold">3</span>
              {isFr ? "Confirmez « Ajouter »" : "Confirm \"Add\""}
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="mt-3 w-full px-4 py-2 text-xs font-bold bg-primary-foreground text-primary rounded-full hover:opacity-90 transition-opacity touch-manipulation flex items-center justify-center gap-2"
          >
            <Download size={14} />
            {isFr ? "Installer" : "Install"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
