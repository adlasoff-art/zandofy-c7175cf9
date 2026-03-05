import { createContext, useContext, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface UIConfig {
  showAppDownloadBanner: boolean;
  showDiscountBadge: boolean;
  setShowAppDownloadBanner: (v: boolean) => void;
  setShowDiscountBadge: (v: boolean) => void;
}

const UIConfigContext = createContext<UIConfig | null>(null);

export function UIConfigProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  // Defaults: app banner visible on both, discount badge hidden on mobile
  const [showAppDownloadBanner, setShowAppDownloadBanner] = useState(true);
  const [showDiscountBadge, setShowDiscountBadge] = useState(true);

  // On mobile, discount badge is off by default (configurable)
  const effectiveDiscountBadge = isMobile ? false : showDiscountBadge;

  return (
    <UIConfigContext.Provider
      value={{
        showAppDownloadBanner,
        showDiscountBadge: effectiveDiscountBadge,
        setShowAppDownloadBanner,
        setShowDiscountBadge,
      }}
    >
      {children}
    </UIConfigContext.Provider>
  );
}

export function useUIConfig() {
  const ctx = useContext(UIConfigContext);
  if (!ctx) throw new Error("useUIConfig must be used within UIConfigProvider");
  return ctx;
}
