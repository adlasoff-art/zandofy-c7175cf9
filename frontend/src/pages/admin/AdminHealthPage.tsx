import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useSystemHealth,
  useHealthIncidents,
  useCronHeartbeats,
  useGlobalHealthStatus,
} from "@/hooks/use-system-health";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  XCircle,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_BADGE: Record<string, { variant: "default" | "destructive" | "outline"; cls: string; label: string }> = {
  ok: { variant: "outline", cls: "bg-green-500/10 text-green-500 border-green-500/30", label: "OK" },
  warn: { variant: "outline", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30", label: "WARN" },
  down: { variant: "destructive", cls: "", label: "DOWN" },
};

function StatusBadge({ status }: { status: string | null }) {
  const cfg = STATUS_BADGE[status || "ok"] || STATUS_BADGE.ok;
  return <Badge variant={cfg.variant} className={cfg.cls}>{cfg.label}</Badge>;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "edge_function") return <Zap className="h-4 w-4 text-muted-foreground" />;
  if (type === "payment_gateway") return <Activity className="h-4 w-4 text-muted-foreground" />;
  if (type === "smtp" || type === "external_api") return <Mail className="h-4 w-4 text-muted-foreground" />;
  if (type === "cron") return <Clock className="h-4 w-4 text-muted-foreground" />;
  return <Activity className="h-4 w-4 text-muted-foreground" />;
}

export default function AdminHealthPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");

  const { data: rows = [], isLoading, isFetching, refetch: refetchHealth } = useSystemHealth();
  const { data: openIncidents = [] } = useHealthIncidents(false);
  const { data: closedIncidents = [] } = useHealthIncidents(true);
  const { data: heartbeats = [] } = useCronHeartbeats();
  const global = useGlobalHealthStatus();

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["monitoring-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("monitoring_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("run-healthchecks", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if (data && typeof data === "object" && (data as { ok?: boolean }).ok === false) {
        throw new Error((data as { error?: string }).error || "run-healthchecks failed");
      }
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Checks: ${data?.total_checks ?? "?"} (${data?.down ?? 0} down, ${data?.warn ?? 0} warn)`,
      );
      queryClient.invalidateQueries({ queryKey: ["system-health"] });
      queryClient.invalidateQueries({ queryKey: ["health-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["cron-heartbeats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeIncident = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { error } = await (supabase as any)
        .from("health_incidents")
        .update({ closed_at: new Date().toISOString(), resolution_notes: notes ?? "Closed manually" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incident clôturé");
      queryClient.invalidateQueries({ queryKey: ["health-incidents"] });
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Partial<typeof settings>) => {
      const { error } = await (supabase as any)
        .from("monitoring_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      refetchSettings();
    },
  });

  const globalCfg = global.isLoading
    ? { color: "text-muted-foreground", bg: "bg-muted/30", icon: RefreshCw, label: "Chargement…" }
    : ({
        ok: { color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2, label: "Tout fonctionne" },
        warn: { color: "text-amber-500", bg: "bg-amber-500/10", icon: AlertTriangle, label: "Dégradé" },
        down: { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle, label: "Incident critique" },
      }[global.status] ?? {
        color: "text-muted-foreground",
        bg: "bg-muted/30",
        icon: RefreshCw,
        label: "Chargement…",
      });
  const GlobalIcon = globalCfg.icon;

  return (
    <AdminLayout title="Santé système">
      <div className="space-y-6">
        {/* Header KPIs */}
        <Card className={`p-6 ${globalCfg.bg} border`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <GlobalIcon className={`h-12 w-12 ${globalCfg.color}`} />
              <div>
                <h2 className="text-2xl font-bold text-foreground">{globalCfg.label}</h2>
                <p className="text-sm text-muted-foreground">
                  {rows.length} composants surveillés · {global.openIncidentsCount} incident{global.openIncidentsCount !== 1 ? "s" : ""} ouvert{global.openIncidentsCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={async () => {
                  await Promise.all([
                    refetchHealth(),
                    queryClient.refetchQueries({ queryKey: ["health-incidents"] }),
                    queryClient.refetchQueries({ queryKey: ["cron-heartbeats"] }),
                  ]);
                  toast.success("Données actualisées");
                }}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
              <Button
                size="sm"
                onClick={() => runNow.mutate()}
                disabled={runNow.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                {runNow.isPending ? "Vérification…" : "Lancer maintenant"}
              </Button>
            </div>
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview"><Activity className="h-4 w-4 mr-1" />Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="incidents"><AlertTriangle className="h-4 w-4 mr-1" />Incidents</TabsTrigger>
            <TabsTrigger value="crons"><Clock className="h-4 w-4 mr-1" />Cron jobs</TabsTrigger>
            <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 mr-1" />Réglages</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-3">Composant</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Statut</th>
                      <th className="p-3">Uptime 24h</th>
                      <th className="p-3">Latence moy.</th>
                      <th className="p-3">Dernier check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>
                    )}
                    {!isLoading && rows.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                        Aucune donnée. Cliquez sur « Lancer maintenant » pour démarrer.
                      </td></tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.component} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{r.component}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <TypeIcon type={r.component_type} /> {r.component_type}
                          </span>
                        </td>
                        <td className="p-3"><StatusBadge status={r.last_status} /></td>
                        <td className="p-3">
                          <span className={r.uptime_pct_24h < 95 ? "text-destructive font-medium" : ""}>
                            {r.uptime_pct_24h?.toFixed(1) ?? "—"}%
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.avg_latency_ok ? `${r.avg_latency_ok}ms` : "—"}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {r.last_check_at
                            ? formatDistanceToNow(new Date(r.last_check_at), { addSuffix: true, locale: fr })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* INCIDENTS */}
          <TabsContent value="incidents" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Incidents ouverts ({openIncidents.length})
              </h3>
              {openIncidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun incident ouvert 🎉</p>
              ) : (
                <div className="space-y-2">
                  {openIncidents.map((i) => (
                    <div key={i.id} className="flex items-start justify-between gap-3 p-3 rounded border bg-card">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={i.severity === "critical" ? "destructive" : "outline"} className={i.severity === "warn" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : ""}>
                            {i.severity}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">{i.component}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            ouvert {formatDistanceToNow(new Date(i.opened_at), { addSuffix: true, locale: fr })}
                          </span>
                          {i.occurrences_count > 1 && (
                            <Badge variant="outline" className="text-xs">×{i.occurrences_count}</Badge>
                          )}
                        </div>
                        <p className="font-medium mt-1">{i.title}</p>
                        {i.description && <p className="text-sm text-muted-foreground mt-1">{i.description}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closeIncident.mutate({ id: i.id })}
                      >
                        Clôturer
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Historique récent</h3>
              <div className="space-y-1">
                {closedIncidents.filter((i) => i.closed_at).slice(0, 20).map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                    <span className="font-mono text-xs text-muted-foreground">{i.component}</span>
                    <span className="text-foreground truncate flex-1 mx-3">{i.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {i.closed_at && formatDistanceToNow(new Date(i.closed_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                ))}
                {closedIncidents.filter((i) => i.closed_at).length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun incident clôturé.</p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* CRONS */}
          <TabsContent value="crons">
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-3">Job</th>
                      <th className="p-3">Statut</th>
                      <th className="p-3">Dernier tick</th>
                      <th className="p-3">Intervalle attendu</th>
                      <th className="p-3">Total / Échecs</th>
                      <th className="p-3">Erreur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heartbeats.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                        Aucun cron job enregistré. Les jobs s'enregistrent automatiquement à leur première exécution.
                      </td></tr>
                    )}
                    {heartbeats.map((h) => (
                      <tr key={h.job_name} className="border-t">
                        <td className="p-3 font-mono text-xs">{h.job_name}</td>
                        <td className="p-3"><StatusBadge status={h.last_status} /></td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(h.last_tick_at), { addSuffix: true, locale: fr })}
                        </td>
                        <td className="p-3 text-xs">{h.expected_interval_minutes}min</td>
                        <td className="p-3 text-xs">
                          {h.total_runs} / <span className={h.failed_runs > 0 ? "text-destructive" : ""}>{h.failed_runs}</span>
                        </td>
                        <td className="p-3 text-xs text-destructive max-w-xs truncate">{h.last_error || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings">
            {settings && (
              <Card className="p-6 space-y-6 max-w-2xl">
                <div>
                  <h3 className="font-semibold mb-3">Canaux d'alerte</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Email aux admins</Label>
                      <Switch
                        checked={settings.alert_email_enabled}
                        onCheckedChange={(v) => saveSettings.mutate({ alert_email_enabled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Push web</Label>
                      <Switch
                        checked={settings.alert_push_enabled}
                        onCheckedChange={(v) => saveSettings.mutate({ alert_push_enabled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Bandeau in-app admin</Label>
                      <Switch
                        checked={settings.alert_banner_enabled}
                        onCheckedChange={(v) => saveSettings.mutate({ alert_banner_enabled: v })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Destinataires email (séparés par virgule)</Label>
                      <Input
                        defaultValue={(settings.alert_emails || []).join(", ")}
                        onBlur={(e) => {
                          const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                          saveSettings.mutate({ alert_emails: arr });
                        }}
                        placeholder="admin@zandofy.com, ops@zandofy.com"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Seuils</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Latence KelPay max (ms)</Label>
                      <Input
                        type="number"
                        defaultValue={settings.kelpay_latency_threshold_ms}
                        onBlur={(e) => saveSettings.mutate({ kelpay_latency_threshold_ms: parseInt(e.target.value, 10) })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Latence Edge Functions max (ms)</Label>
                      <Input
                        type="number"
                        defaultValue={settings.ef_latency_threshold_ms}
                        onBlur={(e) => saveSettings.mutate({ ef_latency_threshold_ms: parseInt(e.target.value, 10) })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label>Monitoring activé globalement</Label>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(v) => saveSettings.mutate({ enabled: v })}
                  />
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}