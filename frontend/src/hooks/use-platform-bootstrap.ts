/**
 * usePlatformBootstrap — single-call replacement for 8+ sequential platform_settings reads.
 *
 * Loads branding, SEO, themes, topbar, footer, geo block list, etc. in ONE request via
 * a CDN-cached edge function. Other hooks (use-branding, use-seo-config, use-header-theme...)
 * read from this shared QueryClient cache instead of issuing their own queries.
 *
 * Massive LCP win: ~22 sequential requests → 1 parallelized + cached call.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlatformSettingsMap = Record<string, any>;

const BOOTSTRAP_QUERY_KEY = ["platform-bootstrap"] as const;
const BOOTSTRAP_TIMEOUT_MS = 10_000;

async function readBootstrapFromTable(): Promise<PlatformSettingsMap> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", [
            "branding",
            "seo_config",
            "theme_colors",
            "header_theme",
            "footer_theme",
            "topbar_config",
            "footer_config",
            "free_shipping_threshold",
            "geo_blocked_countries",
            "active_countries",
            "ui_config",
            "visual_search_enabled",
            "maintenance_mode",
            "cookie_settings",
            "cms_texts",
            "app_promo",
            "referral_settings",
            "seo_enabled",
          ]);
  if (error) {
    console.warn("[platform-bootstrap] table fallback failed:", error.message);
    return {};
  }
  const map: PlatformSettingsMap = {};
  for (const row of data ?? []) map[(row as { key: string; value: unknown }).key] = (row as { value: unknown }).value;
  return map;
}

export function usePlatformBootstrap() {
  return useQuery<PlatformSettingsMap>({
    queryKey: BOOTSTRAP_QUERY_KEY,
    queryFn: async () => {
      try {
        const invokePromise = supabase.functions.invoke<{
          settings: PlatformSettingsMap;
        }>("platform-bootstrap", { method: "GET" });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("platform-bootstrap timeout")), BOOTSTRAP_TIMEOUT_MS)
        );
        const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
        if (error) throw error;
        return data?.settings ?? {};
      } catch (e) {
        console.warn("[platform-bootstrap] edge invoke failed, using table:", e);
        return readBootstrapFromTable();
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/** Helper: read a single setting from the bootstrap cache. */
export function useBootstrapSetting<T = any>(key: string, fallback?: T) {
  const { data, isLoading } = usePlatformBootstrap();
  return {
    value: (data?.[key] as T) ?? (fallback as T),
    isLoading,
  };
}
