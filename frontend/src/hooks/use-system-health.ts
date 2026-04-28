import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemHealthRow {
  component: string;
  component_type: string;
  total_checks: number;
  ok_checks: number;
  down_checks: number;
  avg_latency_ok: number | null;
  last_check_at: string | null;
  last_status: "ok" | "warn" | "down" | null;
  uptime_pct_24h: number;
  has_open_incident: boolean;
}

export interface HealthIncident {
  id: string;
  component: string;
  component_type: string;
  severity: "info" | "warn" | "critical";
  title: string;
  description: string | null;
  opened_at: string;
  closed_at: string | null;
  is_open: boolean;
  occurrences_count: number;
  last_occurrence_at: string;
  resolution_notes: string | null;
}

export interface CronHeartbeat {
  job_name: string;
  last_tick_at: string;
  expected_interval_minutes: number;
  last_status: "ok" | "warn" | "down";
  last_error: string | null;
  total_runs: number;
  failed_runs: number;
}

/** Vue agrégée 24h par composant */
export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: async (): Promise<SystemHealthRow[]> => {
      const { data, error } = await (supabase as any)
        .from("v_system_health")
        .select("*")
        .order("uptime_pct_24h", { ascending: true });
      if (error) throw error;
      return (data as SystemHealthRow[]) ?? [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Incidents (ouverts par défaut) */
export function useHealthIncidents(includeClosed = false) {
  return useQuery({
    queryKey: ["health-incidents", includeClosed],
    queryFn: async (): Promise<HealthIncident[]> => {
      let q = (supabase as any)
        .from("health_incidents")
        .select("*")
        .order("opened_at", { ascending: false })
        .limit(50);
      if (!includeClosed) q = q.is("closed_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data as HealthIncident[]) ?? [];
    },
    refetchInterval: 60_000,
  });
}

/** Heartbeats des cron jobs */
export function useCronHeartbeats() {
  return useQuery({
    queryKey: ["cron-heartbeats"],
    queryFn: async (): Promise<CronHeartbeat[]> => {
      const { data, error } = await (supabase as any)
        .from("cron_heartbeats")
        .select("*")
        .order("job_name");
      if (error) throw error;
      return (data as CronHeartbeat[]) ?? [];
    },
    refetchInterval: 60_000,
  });
}

/** Statut global agrégé pour le widget compact */
export function useGlobalHealthStatus() {
  const { data: rows = [], isLoading } = useSystemHealth();
  const { data: incidents = [] } = useHealthIncidents(false);
  const downCount = rows.filter((r) => r.last_status === "down").length;
  const warnCount = rows.filter((r) => r.last_status === "warn").length;
  const openCriticalIncidents = incidents.filter((i) => i.severity === "critical").length;
  let status: "ok" | "warn" | "down" = "ok";
  if (downCount > 0 || openCriticalIncidents > 0) status = "down";
  else if (warnCount > 0 || incidents.length > 0) status = "warn";
  return {
    status,
    downCount,
    warnCount,
    okCount: rows.filter((r) => r.last_status === "ok").length,
    openIncidentsCount: incidents.length,
    isLoading,
  };
}