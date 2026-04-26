/**
 * AdminOperatorsPerformancePage — Lot 11B Phase B9
 *
 * Suivi qualité des opérateurs de livraison :
 *  - Liste consolidée (vue v_operator_performance) : score + KPIs.
 *  - Édition des seuils (delivery_operator_thresholds) + activation suspension auto.
 *  - Bouton "Recalculer maintenant" → invoke auto-suspend-underperforming-operators.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Activity,
  Star,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Clock,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

type PerfRow = {
  operator_id: string;
  company_name: string;
  is_platform_owned: boolean;
  is_active: boolean;
  status: string;
  reliability_score: number | null;
  reliability_window_days: number | null;
  reliability_computed_at: string | null;
  auto_suspended_at: string | null;
  auto_suspension_reason: string | null;
  rating_avg: number | null;
  total_deliveries: number;
  total_assignments: number | null;
  accepted_count: number | null;
  declined_count: number | null;
  expired_count: number | null;
  pending_count: number | null;
  acceptance_rate: number | null;
  decline_rate: number | null;
  expiry_rate: number | null;
  avg_response_minutes: number | null;
  delivered_count: number | null;
  customer_rating_avg: number | null;
  customer_rating_count: number | null;
};

type Thresholds = {
  id: string;
  is_active: boolean;
  window_days: number;
  min_assignments: number;
  min_score: number;
  max_expiry_rate_pct: number;
  max_decline_rate_pct: number;
  auto_suspend_enabled: boolean;
  notes: string | null;
};

export default function AdminOperatorsPerformancePage() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "at_risk" | "suspended">("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["operators-performance"],
    staleTime: 30_000,
    queryFn: async (): Promise<PerfRow[]> => {
      const { data, error } = await (supabase as any)
        .from("v_operator_performance")
        .select("*")
        .order("reliability_score", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: thresholds, isLoading: thLoading } = useQuery({
    queryKey: ["operator-thresholds"],
    queryFn: async (): Promise<Thresholds | null> => {
      const { data, error } = await (supabase as any)
        .from("delivery_operator_thresholds")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<Thresholds | null>(null);
  // Sync form when thresholds load
  useMemo(() => {
    if (thresholds && !form) setForm(thresholds);
  }, [thresholds, form]);

  const saveThresholds = useMutation({
    mutationFn: async (t: Thresholds) => {
      const { error } = await (supabase as any)
        .from("delivery_operator_thresholds")
        .update({
          window_days: t.window_days,
          min_assignments: t.min_assignments,
          min_score: t.min_score,
          max_expiry_rate_pct: t.max_expiry_rate_pct,
          max_decline_rate_pct: t.max_decline_rate_pct,
          auto_suspend_enabled: t.auto_suspend_enabled,
          notes: t.notes,
        })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seuils mis à jour");
      qc.invalidateQueries({ queryKey: ["operator-thresholds"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const runRefresh = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "auto-suspend-underperforming-operators",
        { body: {} },
      );
      if (error) throw error;
      toast.success(
        `Recalcul effectué — ${data?.suspended ?? 0} opérateur(s) suspendu(s)`,
      );
      qc.invalidateQueries({ queryKey: ["operators-performance"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du recalcul");
    } finally {
      setRunning(false);
    }
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.company_name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filter === "suspended" && r.status !== "suspended") return false;
      if (filter === "at_risk") {
        if (!thresholds) return false;
        const expiryHigh =
          (r.expiry_rate ?? 0) > Number(thresholds.max_expiry_rate_pct);
        const declineHigh =
          (r.decline_rate ?? 0) > Number(thresholds.max_decline_rate_pct);
        const lowScore =
          r.reliability_score !== null &&
          Number(r.reliability_score) < Number(thresholds.min_score);
        if (!(expiryHigh || declineHigh || lowScore)) return false;
      }
      return true;
    });
  }, [rows, search, filter, thresholds]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="text-primary" size={22} /> Performance opérateurs
            </h1>
            <p className="text-sm text-muted-foreground">
              Score de fiabilité, taux d'acceptation/expiration, suspension automatique.
            </p>
          </div>
          <Button onClick={runRefresh} disabled={running}>
            {running ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <RefreshCw size={14} className="mr-2" />
            )}
            Recalculer maintenant
          </Button>
        </div>

        {/* Seuils */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seuils & suspension automatique</CardTitle>
          </CardHeader>
          <CardContent>
            {thLoading || !form ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Field label="Fenêtre (jours)">
                    <Input
                      type="number"
                      min={7}
                      max={180}
                      value={form.window_days}
                      onChange={(e) =>
                        setForm({ ...form, window_days: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Min. assignations">
                    <Input
                      type="number"
                      min={1}
                      value={form.min_assignments}
                      onChange={(e) =>
                        setForm({ ...form, min_assignments: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Score min. (0-100)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={form.min_score}
                      onChange={(e) =>
                        setForm({ ...form, min_score: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Taux expiration max (%)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={form.max_expiry_rate_pct}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          max_expiry_rate_pct: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Taux refus max (%)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={form.max_decline_rate_pct}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          max_decline_rate_pct: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between bg-muted/40 rounded-md p-3">
                  <div>
                    <p className="font-medium text-sm">Suspension automatique</p>
                    <p className="text-xs text-muted-foreground">
                      Si activée, les opérateurs sous-performants sont suspendus à chaque exécution du cron.
                    </p>
                  </div>
                  <Switch
                    checked={form.auto_suspend_enabled}
                    onCheckedChange={(v) =>
                      setForm({ ...form, auto_suspend_enabled: v })
                    }
                  />
                </div>
                <Button
                  onClick={() => saveThresholds.mutate(form)}
                  disabled={saveThresholds.isPending}
                >
                  {saveThresholds.isPending && (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  )}
                  Enregistrer les seuils
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtres */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Rechercher un opérateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex gap-1">
            {(["all", "at_risk", "suspended"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "Tous" : f === "at_risk" ? "À risque" : "Suspendus"}
              </Button>
            ))}
          </div>
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun opérateur correspondant.
          </p>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => (
              <OperatorCard key={r.operator_id} row={r} thresholds={thresholds} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function OperatorCard({
  row,
  thresholds,
}: {
  row: PerfRow;
  thresholds: Thresholds | null | undefined;
}) {
  const score = row.reliability_score !== null ? Number(row.reliability_score) : null;
  const scoreColor =
    score === null
      ? "text-muted-foreground"
      : score >= 75
        ? "text-emerald-500"
        : score >= 50
          ? "text-amber-500"
          : "text-red-500";
  const expiryHigh =
    thresholds &&
    (row.expiry_rate ?? 0) > Number(thresholds.max_expiry_rate_pct);
  const declineHigh =
    thresholds &&
    (row.decline_rate ?? 0) > Number(thresholds.max_decline_rate_pct);
  const isSuspended = row.status === "suspended" || !row.is_active;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{row.company_name}</h3>
              {row.is_platform_owned && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  <ShieldCheck size={10} className="mr-0.5" /> Officiel
                </Badge>
              )}
              {isSuspended && (
                <Badge variant="destructive" className="text-[10px]">
                  <ShieldOff size={10} className="mr-0.5" /> Suspendu
                </Badge>
              )}
              {row.auto_suspended_at && (
                <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-500">
                  Auto-suspendu
                </Badge>
              )}
            </div>
            {row.auto_suspension_reason && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle size={11} /> {row.auto_suspension_reason}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Dernier calcul :{" "}
              {row.reliability_computed_at
                ? new Date(row.reliability_computed_at).toLocaleString("fr-FR")
                : "jamais"}{" "}
              · Fenêtre : {row.reliability_window_days ?? 30}j
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${scoreColor}`}>
              {score !== null ? score.toFixed(1) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">Score / 100</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-4">
          <Stat
            icon={Activity}
            label="Assignations"
            value={row.total_assignments?.toString() ?? "0"}
          />
          <Stat
            icon={TrendingUp}
            label="Acceptation"
            value={`${row.acceptance_rate ?? 0}%`}
          />
          <Stat
            icon={TrendingDown}
            label="Refus"
            value={`${row.decline_rate ?? 0}%`}
            warning={declineHigh ?? false}
          />
          <Stat
            icon={Clock}
            label="Expiration"
            value={`${row.expiry_rate ?? 0}%`}
            warning={expiryHigh ?? false}
          />
          <Stat
            icon={Clock}
            label="Délai réponse"
            value={`${Math.round(Number(row.avg_response_minutes ?? 0))}min`}
          />
          <Stat
            icon={Star}
            label="Note client"
            value={
              row.customer_rating_count
                ? `${Number(row.customer_rating_avg ?? 0).toFixed(1)} (${row.customer_rating_count})`
                : "—"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  warning,
}: {
  icon: any;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-md p-2 border ${
        warning ? "border-red-500/40 bg-red-500/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon size={10} /> {label}
      </div>
      <p className={`text-sm font-semibold ${warning ? "text-red-500" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}