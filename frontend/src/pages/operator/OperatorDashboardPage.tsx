/**
 * OperatorDashboardPage — Lot 11B Phase B2
 *
 * KPIs principaux : courses, revenus nets, commission, taux succès, riders.
 * Données : delivery_operators, operator_commission_ledger, orders.
 */
import { useQuery } from "@tanstack/react-query";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { fromTable } from "@/lib/supabase-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Banknote, Percent, Users, Star, TrendingUp, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { OperatorPerformanceWidget } from "@/components/operator/OperatorPerformanceWidget";

export default function OperatorDashboardPage() {
  const { operator } = useOperatorContext();

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ["operator-ledger-summary", operator?.id],
    enabled: !!operator?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await fromTable("operator_commission_ledger")
        .select("delivery_fee, platform_commission_amount, operator_net_amount, recorded_at, payout_status")
        .eq("operator_id", operator!.id)
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Array<{
        delivery_fee: number; platform_commission_amount: number;
        operator_net_amount: number; recorded_at: string; payout_status: string;
      }>;
    },
  });

  const { data: ridersCount = 0 } = useQuery({
    queryKey: ["operator-riders-active", operator?.id],
    enabled: !!operator?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await fromTable("delivery_operator_riders")
        .select("id", { count: "exact", head: true })
        .eq("operator_id", operator!.id)
        .eq("status", "active");
      if (error) return 0;
      return count ?? 0;
    },
  });

  const { data: pendingOrders = 0 } = useQuery({
    queryKey: ["operator-orders-pending", operator?.id],
    enabled: !!operator?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { count } = await fromTable("orders")
        .select("id", { count: "exact", head: true })
        .eq("delivery_operator_id", operator!.id)
        .is("assigned_rider_id", null);
      return count ?? 0;
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayDeliveries = ledger.filter((l) => new Date(l.recorded_at) >= today).length;
  const monthDeliveries = ledger.filter((l) => new Date(l.recorded_at) >= monthStart).length;
  const monthNet = ledger
    .filter((l) => new Date(l.recorded_at) >= monthStart)
    .reduce((s, l) => s + Number(l.operator_net_amount), 0);
  const monthCommission = ledger
    .filter((l) => new Date(l.recorded_at) >= monthStart)
    .reduce((s, l) => s + Number(l.platform_commission_amount), 0);
  const totalLifetime = operator?.total_deliveries ?? 0;

  if (!operator) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenue, {operator.company_name}. Vue d'ensemble de votre activité.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Truck} label="Courses aujourd'hui" value={todayDeliveries.toString()} hint={`${monthDeliveries} ce mois`} />
        <KpiCard icon={Banknote} label="Revenu net (mois)" value={`$${monthNet.toFixed(2)}`} hint={`Net après commission`} />
        <KpiCard icon={Percent} label="Commission retenue" value={`$${monthCommission.toFixed(2)}`} hint={`${operator.platform_commission_pct}% / course`} />
        <KpiCard icon={Users} label="Livreurs actifs" value={`${ridersCount}/${operator.max_riders}`} hint="Quota utilisé" />
      </div>

      {/* B9 — Score de fiabilité */}
      <OperatorPerformanceWidget operatorId={operator.id} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={16} className="text-[hsl(var(--operator-primary))]" />
              Activité globale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total livraisons (vie)" value={totalLifetime.toString()} />
            <Row label="Note moyenne" value={operator.rating_avg ? `${operator.rating_avg.toFixed(2)}/5 ★` : "Non noté"} />
            <Row label="Statut" value={<span className="text-emerald-500 font-medium">● Actif</span>} />
            <Row label="Couverture" value={`${operator.headquarters_city}, ${operator.headquarters_country}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">À traiter</CardTitle>
          </CardHeader>
          <CardContent>
            {ledgerLoading ? (
              <Loader2 className="animate-spin mx-auto" size={20} />
            ) : (
              <div className="space-y-3">
                <Link to="/operator/orders" className="block p-3 rounded-md bg-[hsl(var(--operator-primary))]/10 hover:bg-[hsl(var(--operator-primary))]/15 transition-colors">
                  <p className="text-2xl font-bold text-[hsl(var(--operator-primary))]">{pendingOrders}</p>
                  <p className="text-xs text-muted-foreground">Course(s) en attente d'assignation</p>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <QuickLink to="/operator/fleet" icon={Users} label="Gérer la flotte" />
        <QuickLink to="/operator/rates" icon={Banknote} label="Définir mes tarifs" />
        <QuickLink to="/operator/coverage" icon={Truck} label="Zones de couverture" />
        <QuickLink to="/operator/billing" icon={Star} label="Voir la facturation" />
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon size={14} className="text-[hsl(var(--operator-primary))]" />
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
    <Link to={to} className="flex items-center gap-2 p-3 rounded-md border border-border bg-card hover:border-[hsl(var(--operator-primary))]/40 hover:bg-[hsl(var(--operator-primary))]/5 transition-colors">
      <Icon size={14} className="text-[hsl(var(--operator-primary))]" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}