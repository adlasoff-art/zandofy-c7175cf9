import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useHomeMarket } from "@/contexts/HomeMarketContext";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyDiscoveryPrefs,
  mergeDiscoveryPrefs,
  normalizeDiscoveryPrefs,
  purchaseScopeToHomeMarket,
  readDiscoveryPrefsFromStorage,
  writeDiscoveryPrefsToStorage,
  type DiscoveryPrefs,
} from "@/lib/discovery-prefs";

type DiscoveryPrefsContextValue = {
  prefs: DiscoveryPrefs;
  setPrefs: (next: DiscoveryPrefs, opts?: { persistProfile?: boolean }) => void;
  refresh: () => Promise<void>;
  hasCompleted: boolean;
};

const DiscoveryPrefsContext = createContext<DiscoveryPrefsContextValue | null>(null);

export function DiscoveryPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setMarket } = useHomeMarket();
  const [prefs, setPrefsState] = useState<DiscoveryPrefs>(() => readDiscoveryPrefsFromStorage() || emptyDiscoveryPrefs());

  const applyMarket = useCallback(
    (p: DiscoveryPrefs) => {
      // Only drive market after a completed onboarding — avoid stomping HomeMarketSwitch
      if (p.completed_at && p.purchase_scope) {
        setMarket(purchaseScopeToHomeMarket(p.purchase_scope));
      }
    },
    [setMarket],
  );

  const refresh = useCallback(async () => {
    const local = readDiscoveryPrefsFromStorage();
    let next = local || emptyDiscoveryPrefs();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("discovery_prefs")
        .eq("id", user.id)
        .maybeSingle();
      const remoteRaw = (data as { discovery_prefs?: unknown } | null)?.discovery_prefs;
      const remote = normalizeDiscoveryPrefs(remoteRaw);
      const remoteMeaningful = !!(remote.completed_at || remote.audience || remote.interest_category_ids.length);
      next = mergeDiscoveryPrefs(local, remoteMeaningful ? remote : null);
      if (next.completed_at || next.audience || next.interest_category_ids.length) {
        writeDiscoveryPrefsToStorage(next);
      }
    }
    setPrefsState(next);
    applyMarket(next);
  }, [user, applyMarket]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPrefs = useCallback(
    (next: DiscoveryPrefs, opts?: { persistProfile?: boolean }) => {
      const normalized = normalizeDiscoveryPrefs(next);
      writeDiscoveryPrefsToStorage(normalized);
      setPrefsState(normalized);
      applyMarket(normalized);
      if (opts?.persistProfile && user) {
        void (async () => {
          const { error } = await supabase.rpc("set_own_discovery_prefs", {
            p_prefs: normalized,
          });
          if (error) {
            console.warn("[DiscoveryPrefs] persist failed:", error.message);
          }
        })();
      }
    },
    [user, applyMarket],
  );

  const value = useMemo(
    () => ({
      prefs,
      setPrefs,
      refresh,
      hasCompleted: !!prefs.completed_at,
    }),
    [prefs, setPrefs, refresh],
  );

  return <DiscoveryPrefsContext.Provider value={value}>{children}</DiscoveryPrefsContext.Provider>;
}

export function useDiscoveryPrefs(): DiscoveryPrefsContextValue {
  const ctx = useContext(DiscoveryPrefsContext);
  if (!ctx) {
    return {
      prefs: emptyDiscoveryPrefs(),
      setPrefs: () => {},
      refresh: async () => {},
      hasCompleted: false,
    };
  }
  return ctx;
}
