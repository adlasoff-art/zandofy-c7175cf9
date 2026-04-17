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

export function usePlatformBootstrap() {
  return useQuery<PlatformSettingsMap>({
    queryKey: BOOTSTRAP_QUERY_KEY,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke<{
          settings: PlatformSettingsMap;
        }>("platform-bootstrap", { method: "GET" });
        if (error) throw error;
        return data?.settings ?? {};
      } catch (e) {
        // Fallback: direct table read if edge function fails (cold start, etc.)
        const { data } = await supabase
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
          ]);
        const map: PlatformSettingsMap = {};
        for (const row of data ?? []) map[(row as any).key] = (row as any).value;
        return map;
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
