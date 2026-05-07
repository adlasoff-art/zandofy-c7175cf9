import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

interface UIConfig {
  showAppDownloadBanner: boolean;
  showDiscountBadge: boolean;
  discountBadgeText: string;
  appPromo: { code: string; discount_pct: number; min_order_amount: number; enabled: boolean };
  setShowAppDownloadBanner: (v: boolean) => void;
  setShowDiscountBadge: (v: boolean) => void;
}

const DEFAULT_APP_PROMO = { code: "APP20", discount_pct: 20, min_order_amount: 100, enabled: true };

const UIConfigContext = createContext<UIConfig | null>(null);

export function UIConfigProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [showAppDownloadBanner, setShowAppDownloadBanner] = useState(true);
  const [showDiscountBadge, setShowDiscountBadge] = useState(false);
  const [discountBadgeText, setDiscountBadgeText] = useState("Obtenez 20% de réduction");
  const [appPromo, setAppPromo] = useState(DEFAULT_APP_PROMO);

  // ui_config comes from bootstrap (no extra request)
  const { value: uiConfigValue } = useBootstrapSetting<any>("ui_config");
  // app_promo also comes from bootstrap now (was a separate idle fetch)
  const { value: appPromoValue } = useBootstrapSetting<any>("app_promo");

  useEffect(() => {
    if (uiConfigValue) {
      if (typeof uiConfigValue.showDiscountBadge === "boolean") {
        setShowDiscountBadge(uiConfigValue.showDiscountBadge);
      }
      if (uiConfigValue.discountBadgeText) {
        setDiscountBadgeText(uiConfigValue.discountBadgeText);
      }
    }
  }, [uiConfigValue]);

  useEffect(() => {
    if (appPromoValue) setAppPromo({ ...DEFAULT_APP_PROMO, ...appPromoValue });
  }, [appPromoValue]);

  const effectiveDiscountBadge = isMobile ? false : showDiscountBadge;

  return (
    <UIConfigContext.Provider
      value={{
        showAppDownloadBanner,
        showDiscountBadge: effectiveDiscountBadge,
        discountBadgeText,
        appPromo,
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
