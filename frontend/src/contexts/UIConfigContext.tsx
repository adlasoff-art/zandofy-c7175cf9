import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
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

  // app_promo is not in bootstrap (rarely used) — fetch lazily on idle
  useEffect(() => {
    const w = window as any;
    const load = () => {
      supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "app_promo")
        .maybeSingle()
        .then(({ data }) => {
          if (data?.value) setAppPromo({ ...DEFAULT_APP_PROMO, ...(data.value as any) });
        });
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(load, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
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
