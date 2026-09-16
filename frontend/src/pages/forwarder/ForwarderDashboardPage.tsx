/**
 * ForwarderDashboardPage — tabs Ops | Analytics | Compte (Vague 4).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  FileText, Map, ArrowLeftRight, Loader2, TrendingUp,
  Target, Banknote, Settings, Ship, Users, Wallet,
} from "lucide-react";
import { ForwarderOnboardingChecklist } from "@/components/forwarder/ForwarderOnboardingChecklist";
import { cn } from "@/lib/utils";

type Tab = "ops" | "analytics" | "account";

export default function ForwarderDashboardPage() {
  const { forwarder, canFinance } = useForwarderContext();
  const [tab, setTab] = useState<Tab>("ops");

  const { data: profilesActive = 0 } = useQuery({
    queryKey: ["forwarder-dash-profiles", forwarder?.id],
    enabled: !!forwarder?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await fromTable("forwarder_pricing_profiles")
        .select("id", { count: "exact", head: true })
        .eq("forwarder_id", forwarder!.id)
        .eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: handoffStats, isLoading: handoffLoading } = useQuery({
    queryKey: ["forwarder-dash-handoffs", forwarder?.id],
    enabled: !!forwarder?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
      const { data } = await fromTable("forwarder_handoffs")
        .select("status, created_at")
        .eq("forwarder_id", forwarder!.id)
        .gte("created_at", since)
        .limit(1000);
      const rows = (data ?? []) as Array<{ status: string; created_at: string }>;
      const total = rows.length;
      const accepted = rows.filter((r) => r.status === "accepted" || r.status === "in_transit" || r.status === "delivered").length;
      const declined = rows.filter((r) => r.status === "declined" || r.status === "cancelled").length;
      const decisions = accepted + declined;
      return {
        total,
        accepted,
        rate: decisions > 0 ? Math.round((accepted / decisions) * 100) : null,
        pending: rows.filter((r) => r.status === "pending" || r.status === "notified").length,
      };
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["forwarder-dash-analytics", forwarder?.id],
    enabled: !!forwarder?.id && tab === "analytics" && canFinance,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("external_shipments")
        .select("mode, destination_country_code, weight_kg, quoted_amount, quoted_currency, status")
        .eq("forwarder_id", forwarder!.id)
        .limit(500);
      const rows = (data || []) as any[];
      const byMode: Record<string, number> = {};
      const byDest: Record<string, number> = {};
      let totalQuoted = 0;
      let totalWeight = 0;
      for (const r of rows) {
        byMode[r.mode] = (byMode[r.mode] || 0) + 1;
        const d = r.destination_country_code || "?";
        byDest[d] = (byDest[d] || 0) + 1;
        totalQuoted += Number(r.quoted_amount) || 0;
        totalWeight += Number(r.weight_kg) || 0;
      }
      return { count: rows.length, byMode, byDest, totalQuoted, totalWeight };
    },
  });

  if (!forwarder) return null;

  const routesCount = Array.isArray(forwarder.coverage_routes) ? forwarder.coverage_routes.length : 0;

  const tabs: { id: Tab; label: string; financeOnly?: boolean }[] = [
    { id: "ops", label: "Ops" },
    { id: "analytics", label: "Analytics", financeOnly: true },
    { id: "account", label: "Compte" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenue, {forwarder.name}. Vue d&apos;ensemble de votre activité fret.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs
          .filter((t) => !t.financeOnly || canFinance)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-[hsl(var(--forwarder-primary))] text-[hsl(var(--forwarder-primary))]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "ops" && (
        <div className="space-y-6">
          <ForwarderOnboardingChecklist forwarder={forwarder} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={FileText} label="Profils actifs" value={profilesActive.toString()} hint="Tarifs publiés" />
            <KpiCard icon={Map} label="Routes couvertes" value={routesCount.toString()} hint="Origin → destination" />
            <KpiCard
              icon={ArrowLeftRight}
              label="Handoffs (30j)"
              value={handoffLoading ? "…" : (handoffStats?.total ?? 0).toString()}
              hint={`${handoffStats?.pending ?? 0} en attente`}
            />
            <KpiCard
              icon={Target}
              label="Taux d'acceptation"
              value={handoffStats?.rate != null ? `${handoffStats.rate}%` : "—"}
              hint={
                handoffStats?.rate != null
                  ? `${handoffStats.accepted} acceptés sur 30j`
                  : "Aucune décision sur 30j"
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">À traiter</CardTitle>
              </CardHeader>
              <CardContent>
                {handoffLoading ? (
                  <Loader2 className="animate-spin mx-auto" size={20} />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Link to="/forwarder/handoffs" className="block p-3 rounded-md bg-[hsl(var(--forwarder-primary))]/10 hover:bg-[hsl(var(--forwarder-primary))]/15 transition-colors">
                      <p className="text-2xl font-bold text-[hsl(var(--forwarder-primary))]">{handoffStats?.pending ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Handoff(s) en attente</p>
                    </Link>
                    <Link to="/forwarder/shipments" className="block p-3 rounded-md border border-border hover:bg-muted/40 transition-colors">
                      <Ship size={18} className="text-[hsl(var(--forwarder-primary))] mb-1" />
                      <p className="text-xs font-medium">Expéditions externes</p>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Raccourcis</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <QuickLink to="/forwarder/profiles" icon={Banknote} label="Gérer mes tarifs" />
                <QuickLink to="/forwarder/coverage" icon={Map} label="Mes routes" />
                <QuickLink to="/forwarder/settings" icon={Settings} label="Paramètres" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "analytics" && canFinance && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Ship} label="Expéditions" value={String(analytics?.count ?? "…")} />
            <KpiCard icon={TrendingUp} label="CA quoté (snapshot)" value={
              analytics ? analytics.totalQuoted.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "…"
            } />
            <KpiCard icon={Target} label="Poids total (kg)" value={
              analytics ? analytics.totalWeight.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "…"
            } />
            <KpiCard icon={Wallet} label="Portefeuille" value="→" hint="Ouvrir finance" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Par mode</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {analytics && Object.keys(analytics.byMode).length > 0
                  ? Object.entries(analytics.byMode).map(([k, v]) => (
                      <Row key={k} label={k.toUpperCase()} value={String(v)} />
                    ))
                  : <p className="text-xs text-muted-foreground">Pas encore de données.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Par destination</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {analytics && Object.keys(analytics.byDest).length > 0
                  ? Object.entries(analytics.byDest)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([k, v]) => <Row key={k} label={k} value={String(v)} />)
                  : <p className="text-xs text-muted-foreground">Pas encore de données.</p>}
              </CardContent>
            </Card>
          </div>
          <QuickLink to="/forwarder/wallet" icon={Wallet} label="Ouvrir le portefeuille" />
        </div>
      )}

      {tab === "account" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={16} className="text-[hsl(var(--forwarder-primary))]" />
              Activité globale / compte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Statut" value={<span className="text-emerald-500 font-medium">● {forwarder.status}</span>} />
            <Row label="Modes supportés" value={(forwarder.supported_modes ?? []).join(", ").toUpperCase() || "—"} />
            <Row label="Siège" value={`${forwarder.headquarters_city ?? "—"}${forwarder.headquarters_country ? `, ${forwarder.headquarters_country}` : ""}`} />
            <Row label="Volume mensuel estimé" value={forwarder.estimated_monthly_volume_kg ? `${forwarder.estimated_monthly_volume_kg.toLocaleString()} kg` : "—"} />
            <div className="pt-3 flex flex-wrap gap-2">
              <QuickLink to="/forwarder/team" icon={Users} label="Équipe" />
              <QuickLink to="/forwarder/settings" icon={Settings} label="Paramètres" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon size={14} className="text-[hsl(var(--forwarder-primary))]" />
        </div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 p-3 rounded-md border border-border bg-card hover:border-[hsl(var(--forwarder-primary))]/40 hover:bg-[hsl(var(--forwarder-primary))]/5 transition-colors">
      <Icon size={14} className="text-[hsl(var(--forwarder-primary))]" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
