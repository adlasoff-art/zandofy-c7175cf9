import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type HomeMarket = "all" | "local" | "international";

const STORAGE_KEY = "zandofy_home_market";

function readStored(): HomeMarket {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "local" || raw === "international" || raw === "all") return raw;
  } catch {
    /* private mode */
  }
  return "all";
}

type HomeMarketContextValue = {
  market: HomeMarket;
  setMarket: (m: HomeMarket) => void;
  /** Pass to fetchProducts when not "all". */
  shopTypeFilter: "local" | "international" | undefined;
};

const HomeMarketContext = createContext<HomeMarketContextValue | null>(null);

export function HomeMarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarketState] = useState<HomeMarket>(readStored);

  const setMarket = useCallback((m: HomeMarket) => {
    setMarketState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<HomeMarketContextValue>(
    () => ({
      market,
      setMarket,
      shopTypeFilter: market === "all" ? undefined : market,
    }),
    [market, setMarket],
  );

  return <HomeMarketContext.Provider value={value}>{children}</HomeMarketContext.Provider>;
}

export function useHomeMarket(): HomeMarketContextValue {
  const ctx = useContext(HomeMarketContext);
  if (!ctx) {
    return {
      market: "all",
      setMarket: () => {},
      shopTypeFilter: undefined,
    };
  }
  return ctx;
}
