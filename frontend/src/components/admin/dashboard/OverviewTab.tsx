import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Users, Package, ShoppingBag, DollarSign, Store as StoreIcon, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard, TOOLTIP_STYLE, statusColor, statusLabels } from "./shared";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";
import type { GlobalFilters } from "./DashboardGlobalFilters";

interface Props { period: PeriodKey; geoFilters?: GlobalFilters; }

export function OverviewTab({ period, geoFilters }: Props) {
  const sinceDate = getPeriodDate(period);
  const since = sinceDate?.toISOString() ?? new Date(0).toISOString();
  const country = geoFilters?.country !== "all" ? geoFilters?.country : undefined;
  const city = geoFilters?.city !== "all" ? geoFilters?.city : undefined;

  // Lot 1 — un seul appel RPC agrégé côté Postgres remplace 8 useQuery client.
  const { data: overview, isLoading: lo } = useQuery({
    queryKey: ["admin-overview", period, country, city],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_dashboard_overview", {
        _since: since,
        _country: country ?? null,
        _city: city ?? null,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const orderStats = overview?.orderStats as any;
  const profileCount = Number(overview?.profileCount ?? 0);
  const productCount = Number(overview?.productCount ?? 0);
  const storeCount = Number(overview?.storeCount ?? 0);
  const lp = lo;

  const { data: gatewayFeePct = 2.5 } = useQuery({
    queryKey: ["admin-gateway-fee-pct"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "gateway_fees").maybeSingle();
      return Number((data?.value as any)?.mobile_money_fee_pct) || 2.5;
    },
  });

  const { data: dailySeries = [], isLoading: loadingSeries } = useQuery({
    queryKey: ["admin-overview-daily-series", period, country, city, gatewayFeePct],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_dashboard_daily_series", {
        _since: since,
        _country: country ?? null,
        _city: city ?? null,
      });
      // RPC not applied yet → empty series (Commerce KPIs still work via overview)
      if (error) return [];
      const rows = (data ?? []) as any[];
      return rows.map((row) => {
        const gross = Number(row.mobile_money_gross ?? 0);
        const gatewayFees = gross * (gatewayFeePct / 100);
        return {
          date: format(parseISO(row.day), rows.length > 60 ? "d/MM" : "d MMM", { locale: fr }),
          delivered: Number(row.delivered_count ?? 0),
          pending: Number(row.pending_count ?? 0),
          cancelled: Number(row.cancelled_count ?? 0),
          failedAmount: Number(row.failed_amount ?? 0),
          orderAmount: Number(row.order_amount ?? 0),
          shippingAmount: Number(row.shipping_amount ?? 0),
          lastMileAmount: Number(row.last_mile_amount ?? 0),
          mobileMoneyGross: gross,
          gatewayFees,
          mobileMoneyNet: gross - gatewayFees,
          disputes: Number(row.disputes_count ?? 0),
          returns: Number(row.returns_count ?? 0),
          paymentsSuccessful: Number(row.payments_successful ?? 0),
          paymentsFailed: Number(row.payments_failed ?? 0),
          paymentsPending: Number(row.payments_pending ?? 0),
        };
      });
    },
  });

  const roleCounts: { role: string; count: number }[] = overview?.roleCounts ?? [];
  const recentOrders: any[] = overview?.recentOrders ?? [];
  const loadingRecent = lo;

  const loading = lp || lo;
  const roleLabels: Record<string, string> = {
    vendor: "Vendeurs",
    forwarder: "Transitaires",
    shipper: "Hubs locaux",
    operator: "Entreprises de livraison",
    rider: "Livreurs",
    manager: "Managers",
    admin: "Admins",
  };
  const roleColors: Record<string, string> = {
    vendor: "bg-primary",
    forwarder: "bg-cyan-500",
    shipper: "bg-blue-500",
    operator: "bg-indigo-500",
    rider: "bg-amber-500",
    manager: "bg-purple-500",
    admin: "bg-destructive",
  };
  const orderStatusEntries = Object.entries(orderStats?.byStatus ?? {});

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Commerce</h2>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard icon={Users} label="Utilisateurs" value={loading ? "..." : profileCount.toLocaleString()} />
        <KpiCard icon={ShoppingBag} label="Commandes valides" value={loading ? "..." : (orderStats?.count ?? 0).toLocaleString()} />
        <KpiCard icon={TrendingUp} label="Revenu actuel" value={loading ? "..." : `$${(orderStats?.currentRevenue ?? 0).toLocaleString()}`} color="text-amber-500" />
        <KpiCard icon={DollarSign} label="Revenu validé" value={loading ? "..." : `$${(orderStats?.revenue ?? 0).toLocaleString()}`} />
        <KpiCard icon={Package} label="Produits" value={productCount.toLocaleString()} />
        <KpiCard icon={StoreIcon} label="Boutiques" value={storeCount.toLocaleString()} />
      </div>

      {loadingSeries ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : dailySeries.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-xl p-4">
          Séries temporelles indisponibles — appliquez la migration <code className="text-[10px]">admin_dashboard_daily_series</code> sur le projet Supabase, puis rechargez.
        </p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <OverviewSeriesChart title="Santé commandes" data={dailySeries} moneyKey="failedAmount">
            <Area type="monotone" dataKey="delivered" name="Livrées" stroke="hsl(142, 70%, 40%)" fill="hsl(142, 70%, 40%)" fillOpacity={0.18} yAxisId="count" />
            <Line type="monotone" dataKey="pending" name="En attente" stroke="hsl(40, 80%, 50%)" dot={false} yAxisId="count" />
            <Line type="monotone" dataKey="cancelled" name="Annulées / retours" stroke="hsl(0, 75%, 55%)" dot={false} yAxisId="count" />
            <Line type="monotone" dataKey="failedAmount" name="Montant échoué ($)" stroke="hsl(280, 60%, 50%)" dot={false} yAxisId="money" />
          </OverviewSeriesChart>

          <OverviewSeriesChart title="Revenus & passerelle" data={dailySeries} moneyOnly>
            <Area type="monotone" dataKey="mobileMoneyGross" name="Brut Mobile Money" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} yAxisId="money" />
            <Line type="monotone" dataKey="orderAmount" name="Commandes" stroke="hsl(210, 70%, 50%)" dot={false} yAxisId="money" />
            <Line type="monotone" dataKey="shippingAmount" name="Expédition" stroke="hsl(160, 60%, 40%)" dot={false} yAxisId="money" />
            <Line type="monotone" dataKey="lastMileAmount" name="Dernier km" stroke="hsl(280, 60%, 50%)" dot={false} yAxisId="money" />
            <Line type="monotone" dataKey="gatewayFees" name={`Frais (${gatewayFeePct}%)`} stroke="hsl(0, 75%, 55%)" dot={false} yAxisId="money" />
            <Line type="monotone" dataKey="mobileMoneyNet" name="Net Mobile Money" stroke="hsl(142, 70%, 40%)" dot={false} yAxisId="money" />
          </OverviewSeriesChart>

          <OverviewSeriesChart title="Après-vente & paiements" data={dailySeries}>
            <Area type="monotone" dataKey="paymentsSuccessful" name="Paiements réussis" stroke="hsl(142, 70%, 40%)" fill="hsl(142, 70%, 40%)" fillOpacity={0.18} yAxisId="count" />
            <Line type="monotone" dataKey="disputes" name="Litiges" stroke="hsl(0, 75%, 55%)" dot={false} yAxisId="count" />
            <Line type="monotone" dataKey="returns" name="Retours" stroke="hsl(40, 80%, 50%)" dot={false} yAxisId="count" />
            <Line type="monotone" dataKey="paymentsFailed" name="Paiements échoués" stroke="hsl(330, 60%, 50%)" dot={false} yAxisId="count" />
            <Line type="monotone" dataKey="paymentsPending" name="Paiements en attente" stroke="hsl(210, 70%, 50%)" dot={false} yAxisId="count" />
          </OverviewSeriesChart>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Commandes récentes</h2>
          {loadingRecent ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
          ) : recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune commande</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left pb-2 font-medium">Réf</th>
                    <th className="text-left pb-2 font-medium">Client</th>
                    <th className="text-left pb-2 font-medium">Total</th>
                    <th className="text-left pb-2 font-medium">Statut</th>
                    <th className="text-right pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.order_ref} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-mono text-xs">{o.order_ref}</td>
                      <td className="py-2.5">{o.shipping_first_name} {o.shipping_last_name?.charAt(0)}.</td>
                      <td className="py-2.5 font-semibold">${Number(o.total).toFixed(2)}</td>
                      <td className="py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor[o.status] || "bg-muted text-muted-foreground"}`}>
                          {statusLabels[o.status] || o.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground text-xs">{format(new Date(o.created_at), "d MMM", { locale: fr })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Répartition des rôles</h2>
            {roleCounts.length === 0 ? <p className="text-sm text-muted-foreground">Aucun rôle</p> : (
              <div className="space-y-1">
                {roleCounts.map((r) => (
                  <div key={r.role} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${roleColors[r.role] || "bg-muted"}`} />
                      <span className="text-sm text-foreground">{roleLabels[r.role] || r.role}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {orderStatusEntries.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Statuts commandes</h2>
              <div className="space-y-2">
                {orderStatusEntries.map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor[status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabels[status] || status}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewSeriesChart({ title, data, children, moneyKey, moneyOnly = false }: {
  title: string;
  data: any[];
  children: React.ReactNode;
  moneyKey?: string;
  moneyOnly?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(data.length / 8))} />
            {!moneyOnly && <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 10 }} />}
            {(moneyOnly || moneyKey) && <YAxis yAxisId="money" orientation={moneyOnly ? "left" : "right"} tick={{ fontSize: 10 }} />}
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number, name: string, item: any) => [
              item?.dataKey === moneyKey || moneyOnly ? `$${Number(value).toLocaleString("fr-FR")}` : Number(value).toLocaleString("fr-FR"),
              name,
            ]} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
            {children}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
