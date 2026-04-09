import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

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
  const [showDiscountBadge, setShowDiscountBadge] = useState(false); // disabled by default
  const [discountBadgeText, setDiscountBadgeText] = useState("Obtenez 20% de réduction");
  const [appPromo, setAppPromo] = useState(DEFAULT_APP_PROMO);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["ui_config", "app_promo"])
      .then(({ data }) => {
        data?.forEach((row) => {
          const v = row.value as any;
          if (row.key === "ui_config") {
            if (typeof v?.showDiscountBadge === "boolean") setShowDiscountBadge(v.showDiscountBadge);
            if (v?.discountBadgeText) setDiscountBadgeText(v.discountBadgeText);
          }
          if (row.key === "app_promo") {
            setAppPromo({ ...DEFAULT_APP_PROMO, ...v });
          }
        });
      });
  }, []);

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
