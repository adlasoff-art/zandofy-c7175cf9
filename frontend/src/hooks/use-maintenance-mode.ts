/**
 * use-maintenance-mode — lecture réactive de `platform_settings.maintenance_mode`.
 *
 * Volontairement séparée de `usePlatformBootstrap` (cache CDN 5 min) car le
 * mode maintenance est un kill-switch qui doit se propager en quelques secondes.
 * Lecture directe sur la table (RLS lecture anon ouverte sur cette clé), polling
 * léger toutes les 30 s + refetch au focus.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformBootstrap } from "@/hooks/use-platform-bootstrap";

export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  end_time: string;
}

export const MAINTENANCE_QUERY_KEY = ["maintenance-mode"] as const;

export function useMaintenanceMode() {
  // Initial value is hydrated from the bootstrap cache (already in flight on first
  // paint), so the maintenance check is available without an extra round-trip.
  const { data: bootstrap } = usePlatformBootstrap();
  const initial =
    (bootstrap?.maintenance_mode as MaintenanceConfig | undefined) ?? null;

  return useQuery<MaintenanceConfig | null>({
    queryKey: MAINTENANCE_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as unknown as MaintenanceConfig | null) ?? null;
    },
    initialData: initial,
    initialDataUpdatedAt: bootstrap ? Date.now() : 0,
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
  });
}