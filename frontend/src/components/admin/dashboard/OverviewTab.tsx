import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Users, Package, ShoppingBag, DollarSign, Store as StoreIcon, CheckCircle2, Clock, XCircle, Ban, ShieldAlert, RotateCcw, CreditCard, AlertTriangle, TrendingUp, Wallet, Receipt, Truck, Home } from "lucide-react";
import { KpiCard, KpiCardRow, statusColor, statusLabels } from "./shared";
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
  const paymentStats = overview?.paymentStats as any;
  const disputeStats = overview?.disputeStats as any;
  const returnStats = overview?.returnStats as any;
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

  const mobileMoneyGross = paymentStats?.mobileMoneyGross ?? 0;
  const actualGatewayFees = Math.round(mobileMoneyGross * gatewayFeePct) / 100;
  const actualNetRevenue = mobileMoneyGross - actualGatewayFees;

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

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Santé des commandes</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardRow icon={CheckCircle2} label="Livrées" value={(orderStats?.deliveredCount ?? 0).toString()} />
        <KpiCardRow icon={Clock} label="En attente" value={(orderStats?.pendingCount ?? 0).toString()} color="text-amber-500" />
        <KpiCardRow icon={XCircle} label="Annulées / retournées" value={(orderStats?.cancelledCount ?? 0).toString()} color="text-destructive" />
        <KpiCardRow icon={Ban} label="Montant cmd échouées" value={`$${(orderStats?.failedAmount ?? 0).toLocaleString()}`} color="text-destructive" />
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Revenus & Passerelle Mobile Money</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard icon={CreditCard} label="Paiements commandes" value={`$${(paymentStats?.orderAmount ?? 0).toFixed(2)}`} sub="Mobile Money réussis" />
        <KpiCard icon={Truck} label="Paiements expédition" value={`$${(paymentStats?.shippingAmount ?? 0).toFixed(2)}`} sub="Shipping payés via MM" color="text-blue-500" />
        <KpiCard icon={Home} label="Paiements livraison domicile" value={`$${(paymentStats?.lastMileAmount ?? 0).toFixed(2)}`} sub="Last-mile payés via MM" color="text-purple-500" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Wallet} label="Brut Mobile Money" value={`$${mobileMoneyGross.toFixed(2)}`} sub="Total perçu via MM" />
        <KpiCard icon={Receipt} label={`Frais passerelle (${gatewayFeePct}%)`} value={`-$${actualGatewayFees.toFixed(2)}`} sub="Estimé KelPay" color="text-destructive" />
        <KpiCard icon={DollarSign} label="Net plateforme (MM)" value={`$${actualNetRevenue.toFixed(2)}`} sub="Après déduction frais" color="text-green-500" />
        <KpiCard icon={CheckCircle2} label="Preuves validées" value={`$${((orderStats?.proofShippingPaid ?? 0) + (orderStats?.proofLastMilePaid ?? 0)).toFixed(2)}`} sub={`Expéd: $${(orderStats?.proofShippingPaid ?? 0).toFixed(2)} | Livr: $${(orderStats?.proofLastMilePaid ?? 0).toFixed(2)}`} />
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Après-vente & Paiements</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ShieldAlert} label="Litiges" value={(disputeStats?.total ?? 0).toString()} color="text-destructive" sub={`${disputeStats?.open ?? 0} ouvert(s)`} />
        <KpiCard icon={RotateCcw} label="Retours" value={(returnStats?.total ?? 0).toString()} color="text-amber-500" sub={`${returnStats?.pending ?? 0} en attente`} />
        <KpiCard icon={CreditCard} label="Paiements réussis" value={(paymentStats?.successful ?? 0).toString()} sub={`$${(paymentStats?.totalAmount ?? 0).toLocaleString()}`} />
        <KpiCard icon={AlertTriangle} label="Paiements échoués" value={(paymentStats?.failed ?? 0).toString()} color="text-destructive" sub={`${paymentStats?.pending ?? 0} transaction(s) en attente`} />
      </div>

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
