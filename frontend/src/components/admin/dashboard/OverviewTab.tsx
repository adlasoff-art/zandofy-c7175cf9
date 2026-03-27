import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Users, Package, ShoppingBag, DollarSign, Store as StoreIcon, CheckCircle2, Clock, XCircle, Ban, ShieldAlert, RotateCcw, CreditCard, AlertTriangle, TrendingUp, Wallet, Receipt, Truck, Home } from "lucide-react";
import { KpiCard, KpiCardRow, statusColor, statusLabels } from "./shared";
import { NON_REVENUE_ORDER_STATUSES, REAL_REVENUE_ORDER_STATUSES } from "@/lib/order-status";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";

interface Props { period: PeriodKey; }

export function OverviewTab({ period }: Props) {
  const since = getPeriodDate(period).toISOString();

  const { data: profileCount = 0, isLoading: lp } = useQuery({
    queryKey: ["admin-profiles-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: orderStats, isLoading: lo } = useQuery({
    queryKey: ["admin-order-stats", period],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("total, status, shipping_payment_status, last_mile_payment_status, shipping_cost, last_mile_fee, shipping_payment_proof_url, last_mile_payment_proof_url").gte("created_at", since);
      if (!data) return { count: 0, revenue: 0, currentRevenue: 0, cancelledRevenue: 0, cancelledCount: 0, deliveredCount: 0, pendingCount: 0, failedAmount: 0, failedCount: 0, byStatus: {} as Record<string, number>, proofShippingPaid: 0, proofLastMilePaid: 0 };
      const byStatus: Record<string, number> = {};
      let revenue = 0, currentRevenue = 0, cancelledRevenue = 0, cancelledCount = 0, deliveredCount = 0, pendingCount = 0, failedAmount = 0, failedCount = 0, opCount = 0;
      let proofShippingPaid = 0, proofLastMilePaid = 0;
      data.forEach((o) => {
        byStatus[o.status] = (byStatus[o.status] || 0) + 1;
        if (o.status === "cancelled" || o.status === "returned") { cancelledRevenue += Number(o.total); cancelledCount++; }
        if (!NON_REVENUE_ORDER_STATUSES.includes(o.status as never)) { opCount++; currentRevenue += Number(o.total); }
        if (REAL_REVENUE_ORDER_STATUSES.includes(o.status as never)) { revenue += Number(o.total); }
        if (o.status === "delivered") deliveredCount++;
        if (o.status === "pending") pendingCount++;
        if (o.status === "payment_failed" || o.status === "awaiting_payment") { failedAmount += Number(o.total); failedCount++; }
        if (o.shipping_payment_status === "paid" && o.shipping_payment_proof_url) proofShippingPaid += Number(o.shipping_cost || 0);
        if (o.last_mile_payment_status === "paid" && o.last_mile_payment_proof_url) proofLastMilePaid += Number(o.last_mile_fee || 0);
      });
      return { count: opCount, revenue, currentRevenue, cancelledRevenue, cancelledCount, deliveredCount, pendingCount, failedAmount, failedCount, byStatus, proofShippingPaid, proofLastMilePaid };
    },
  });

  const { data: productCount = 0 } = useQuery({
    queryKey: ["admin-products-count"],
    queryFn: async () => { const { count } = await supabase.from("products").select("*", { count: "exact", head: true }); return count ?? 0; },
  });

  const { data: storeCount = 0 } = useQuery({
    queryKey: ["admin-stores-count"],
    queryFn: async () => { const { count } = await supabase.from("stores").select("*", { count: "exact", head: true }); return count ?? 0; },
  });

  const { data: disputeStats } = useQuery({
    queryKey: ["admin-dispute-stats", period],
    queryFn: async () => {
      const { data } = await supabase.from("disputes").select("status").gte("created_at", since);
      if (!data) return { total: 0, open: 0 };
      return { total: data.length, open: data.filter(d => d.status === "open").length };
    },
  });

  const { data: returnStats } = useQuery({
    queryKey: ["admin-return-stats", period],
    queryFn: async () => {
      const { data } = await supabase.from("return_requests").select("status").gte("created_at", since);
      if (!data) return { total: 0, pending: 0 };
      return { total: data.length, pending: data.filter(r => r.status === "pending").length };
    },
  });

  // Enhanced payment stats with payment_type breakdown
  const { data: paymentStats } = useQuery({
    queryKey: ["admin-payment-stats-v2", period],
    queryFn: async () => {
      const { data } = await (supabase as any).from("payment_transactions").select("status, amount, method, payment_type").gte("created_at", since);
      if (!data) return { successful: 0, failed: 0, pending: 0, totalAmount: 0, orderAmount: 0, shippingAmount: 0, lastMileAmount: 0, mobileMoneyGross: 0, gatewayFees: 0, netRevenue: 0 };

      const successful = data.filter((p: any) => p.status === "success" || p.status === "completed");
      const mobileMoneySuccessful = successful.filter((p: any) => p.method === "mobile_money");

      let orderAmount = 0, shippingAmount = 0, lastMileAmount = 0;
      successful.forEach((p: any) => {
        const amt = Number(p.amount);
        const pType = p.payment_type || "order";
        if (pType === "shipping") shippingAmount += amt;
        else if (pType === "last_mile") lastMileAmount += amt;
        else orderAmount += amt;
      });

      const mobileMoneyGross = mobileMoneySuccessful.reduce((s: number, p: any) => s + Number(p.amount), 0);
      // Read fee pct from settings will be done client-side, default 2.5%
      const gatewayFeePct = 2.5;
      const gatewayFees = Math.round(mobileMoneyGross * gatewayFeePct) / 100;
      const netRevenue = mobileMoneyGross - gatewayFees;

      return {
        successful: successful.length,
        pending: data.filter((p: any) => p.status === "pending").length,
        failed: data.filter((p: any) => p.status === "failed").length,
        totalAmount: successful.reduce((s: number, p: any) => s + Number(p.amount), 0),
        orderAmount,
        shippingAmount,
        lastMileAmount,
        mobileMoneyGross,
        gatewayFees,
        netRevenue,
      };
    },
  });

  // Load gateway fee setting
  const { data: gatewayFeePct = 2.5 } = useQuery({
    queryKey: ["admin-gateway-fee-pct"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "gateway_fees").maybeSingle();
      return Number((data?.value as any)?.mobile_money_fee_pct) || 2.5;
    },
  });

  // Recalculate with actual fee pct
  const mobileMoneyGross = paymentStats?.mobileMoneyGross ?? 0;
  const actualGatewayFees = Math.round(mobileMoneyGross * gatewayFeePct) / 100;
  const actualNetRevenue = mobileMoneyGross - actualGatewayFees;

  const { data: roleCounts = [] } = useQuery({
    queryKey: ["admin-role-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role");
      if (!data) return [];
      const map: Record<string, number> = {};
      data.forEach((r) => { map[r.role] = (map[r.role] || 0) + 1; });
      return Object.entries(map).map(([role, count]) => ({ role, count }));
    },
  });

  const { data: recentOrders = [], isLoading: loadingRecent } = useQuery({
    queryKey: ["admin-recent-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("order_ref, shipping_first_name, shipping_last_name, total, status, created_at").order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
  });

  const loading = lp || lo;
  const roleLabels: Record<string, string> = { vendor: "Vendeurs", shipper: "Transporteurs", rider: "Livreurs", manager: "Managers", admin: "Admins" };
  const roleColors: Record<string, string> = { vendor: "bg-primary", shipper: "bg-blue-500", rider: "bg-amber-500", manager: "bg-purple-500", admin: "bg-destructive" };
  const orderStatusEntries = Object.entries(orderStats?.byStatus ?? {});

  return (
    <div className="space-y-4">
      {/* Commerce */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Commerce</h2>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard icon={Users} label="Utilisateurs" value={loading ? "..." : profileCount.toLocaleString()} />
        <KpiCard icon={ShoppingBag} label="Commandes valides" value={loading ? "..." : (orderStats?.count ?? 0).toLocaleString()} />
        <KpiCard icon={TrendingUp} label="Revenu actuel" value={loading ? "..." : `$${(orderStats?.currentRevenue ?? 0).toLocaleString()}`} color="text-amber-500" />
        <KpiCard icon={DollarSign} label="Revenu validé" value={loading ? "..." : `$${(orderStats?.revenue ?? 0).toLocaleString()}`} />
        <KpiCard icon={Package} label="Produits" value={productCount.toLocaleString()} />
        <KpiCard icon={StoreIcon} label="Boutiques" value={storeCount.toLocaleString()} />
      </div>

      {/* Santé */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Santé des commandes</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardRow icon={CheckCircle2} label="Livrées" value={(orderStats?.deliveredCount ?? 0).toString()} />
        <KpiCardRow icon={Clock} label="En attente" value={(orderStats?.pendingCount ?? 0).toString()} color="text-amber-500" />
        <KpiCardRow icon={XCircle} label="Annulées / retournées" value={(orderStats?.cancelledCount ?? 0).toString()} color="text-destructive" />
        <KpiCardRow icon={Ban} label="Montant cmd échouées" value={`$${(orderStats?.failedAmount ?? 0).toLocaleString()}`} color="text-destructive" />
      </div>

      {/* Revenus & Passerelle */}
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

      {/* Après-vente */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Après-vente & Paiements</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ShieldAlert} label="Litiges" value={(disputeStats?.total ?? 0).toString()} color="text-destructive" sub={`${disputeStats?.open ?? 0} ouvert(s)`} />
        <KpiCard icon={RotateCcw} label="Retours" value={(returnStats?.total ?? 0).toString()} color="text-amber-500" sub={`${returnStats?.pending ?? 0} en attente`} />
        <KpiCard icon={CreditCard} label="Paiements réussis" value={(paymentStats?.successful ?? 0).toString()} sub={`$${(paymentStats?.totalAmount ?? 0).toLocaleString()}`} />
        <KpiCard icon={AlertTriangle} label="Paiements échoués" value={(paymentStats?.failed ?? 0).toString()} color="text-destructive" sub={`${paymentStats?.pending ?? 0} transaction(s) en attente`} />
      </div>

      {/* Bottom: Recent orders + sidebar */}
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
                    <span className="text-sm font-semibold text-foreground">{count}</span>
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
