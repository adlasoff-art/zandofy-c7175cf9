import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Users, Package, ShoppingBag, DollarSign, Store as StoreIcon, Loader2,
  Truck, Ship, TrendingUp, XCircle, AlertTriangle, RotateCcw, UserCheck,
  Bike, CreditCard, Ban, CheckCircle2, Clock, ShieldAlert,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { NON_REVENUE_ORDER_STATUSES } from "@/lib/order-status";

const statusColor: Record<string, string> = {
  delivered: "bg-primary/10 text-primary",
  in_transit: "bg-blue-100 text-blue-700",
  shipped: "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  pending: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  pending: "En attente", processing: "En préparation", shipped: "Expédiée",
  in_transit: "En transit", delivered: "Livrée", cancelled: "Annulée",
};

const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(210, 70%, 50%)", "hsl(40, 80%, 50%)",
  "hsl(280, 60%, 50%)", "hsl(0, 70%, 55%)",
];

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-recent-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ─── Profiles count ───
  const { data: profileCount = 0, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // ─── Order stats (separate cancelled from real revenue) ───
  const { data: orderStats, isLoading: loadingOrders } = useQuery({
    queryKey: ["admin-order-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("total, status");
      if (!data) return { count: 0, revenue: 0, cancelledRevenue: 0, cancelledCount: 0, deliveredCount: 0, pendingCount: 0, byStatus: {} as Record<string, number> };
      const byStatus: Record<string, number> = {};
      let revenue = 0;
      let cancelledRevenue = 0;
      let cancelledCount = 0;
      let deliveredCount = 0;
      let pendingCount = 0;
      let operationalCount = 0;
      data.forEach((o) => {
        byStatus[o.status] = (byStatus[o.status] || 0) + 1;
        if (o.status === "cancelled" || o.status === "returned") {
          cancelledRevenue += Number(o.total);
          cancelledCount++;
        }
        if (!NON_REVENUE_ORDER_STATUSES.includes(o.status as never)) {
          operationalCount++;
          revenue += Number(o.total);
        }
        if (o.status === "delivered") deliveredCount++;
        if (o.status === "pending") pendingCount++;
      });
      return { count: operationalCount, revenue, cancelledRevenue, cancelledCount, deliveredCount, pendingCount, byStatus };
    },
  });

  // ─── Products count ───
  const { data: productCount = 0 } = useQuery({
    queryKey: ["admin-products-count"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // ─── Stores count ───
  const { data: storeCount = 0 } = useQuery({
    queryKey: ["admin-stores-count"],
    queryFn: async () => {
      const { count } = await supabase.from("stores").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // ─── Disputes count ───
  const { data: disputeStats } = useQuery({
    queryKey: ["admin-dispute-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("disputes").select("status");
      if (!data) return { total: 0, open: 0, resolved: 0 };
      return {
        total: data.length,
        open: data.filter(d => d.status === "open").length,
        resolved: data.filter(d => d.status === "resolved").length,
      };
    },
  });

  // ─── Returns count ───
  const { data: returnStats } = useQuery({
    queryKey: ["admin-return-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("return_requests").select("status");
      if (!data) return { total: 0, pending: 0, approved: 0, rejected: 0 };
      return {
        total: data.length,
        pending: data.filter(r => r.status === "pending").length,
        approved: data.filter(r => r.status === "approved").length,
        rejected: data.filter(r => r.status === "rejected").length,
      };
    },
  });

  // ─── Role counts ───
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

  // ─── Recent orders ───
  const { data: recentOrders = [], isLoading: loadingRecent } = useQuery({
    queryKey: ["admin-recent-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("order_ref, shipping_first_name, shipping_last_name, total, status, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  // ─── Delivery chart (14 days) ───
  const { data: deliveryChart = [] } = useQuery({
    queryKey: ["admin-delivery-chart"],
    queryFn: async () => {
      const since = subDays(new Date(), 13);
      const { data } = await supabase
        .from("deliveries")
        .select("delivery_date, status")
        .gte("delivery_date", format(startOfDay(since), "yyyy-MM-dd"));
      const days: Record<string, { date: string; total: number; delivered: number; pending: number }> = {};
      for (let i = 0; i < 14; i++) {
        const d = format(subDays(new Date(), 13 - i), "yyyy-MM-dd");
        const label = format(subDays(new Date(), 13 - i), "d MMM", { locale: fr });
        days[d] = { date: label, total: 0, delivered: 0, pending: 0 };
      }
      (data ?? []).forEach((d) => {
        const day = days[d.delivery_date];
        if (day) { day.total++; if (d.status === "delivered") day.delivered++; else day.pending++; }
      });
      return Object.values(days);
    },
  });

  // ─── Shipment stats ───
  const { data: shipmentStats } = useQuery({
    queryKey: ["admin-shipment-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("shipments").select("mode, status, created_at");
      if (!data) return { byMode: [], byStatus: [], total: 0 };
      const modeMap: Record<string, number> = {};
      const statusMap: Record<string, number> = {};
      data.forEach((s) => {
        modeMap[s.mode] = (modeMap[s.mode] || 0) + 1;
        statusMap[s.status] = (statusMap[s.status] || 0) + 1;
      });
      return {
        total: data.length,
        byMode: Object.entries(modeMap).map(([name, value]) => ({ name: name === "air" ? "Aérien" : name === "sea" ? "Maritime" : "Routier", value })),
        byStatus: Object.entries(statusMap).map(([name, value]) => ({ name, value })),
      };
    },
  });

  // ─── Delivery summary ───
  const { data: deliverySummary } = useQuery({
    queryKey: ["admin-delivery-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("deliveries").select("status");
      if (!data) return { total: 0, delivered: 0, inProgress: 0, pending: 0 };
      return {
        total: data.length,
        delivered: data.filter((d) => d.status === "delivered").length,
        inProgress: data.filter((d) => d.status === "in_progress").length,
        pending: data.filter((d) => d.status === "pending").length,
      };
    },
  });

  // ─── Payment transactions stats ───
  const { data: paymentStats } = useQuery({
    queryKey: ["admin-payment-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_transactions").select("status, amount");
      if (!data) return { total: 0, successful: 0, pending: 0, failed: 0, totalAmount: 0 };
      return {
        total: data.length,
        successful: data.filter(p => p.status === "success" || p.status === "completed").length,
        pending: data.filter(p => p.status === "pending").length,
        failed: data.filter(p => p.status === "failed").length,
        totalAmount: data.filter(p => p.status === "success" || p.status === "completed").reduce((s, p) => s + Number(p.amount), 0),
      };
    },
  });

  const loading = loadingProfiles || loadingOrders;

  // ─── KPI sections ───
  const commerceStats = [
    { label: "Utilisateurs", value: profileCount.toLocaleString(), icon: Users, color: "text-primary" },
    { label: "Commandes valides", value: (orderStats?.count ?? 0).toLocaleString(), icon: ShoppingBag, color: "text-primary" },
    { label: "Revenu réel encaissé", value: `$${(orderStats?.revenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-primary" },
    { label: "Produits", value: productCount.toLocaleString(), icon: Package, color: "text-primary" },
    { label: "Boutiques", value: storeCount.toLocaleString(), icon: StoreIcon, color: "text-primary" },
  ];

  const orderHealthStats = [
    { label: "Livrées", value: (orderStats?.deliveredCount ?? 0).toString(), icon: CheckCircle2, color: "text-primary" },
    { label: "En attente", value: (orderStats?.pendingCount ?? 0).toString(), icon: Clock, color: "text-amber-500" },
    { label: "Annulées / retournées", value: (orderStats?.cancelledCount ?? 0).toString(), icon: XCircle, color: "text-destructive" },
    { label: "Montant perdu", value: `$${(orderStats?.cancelledRevenue ?? 0).toLocaleString()}`, icon: Ban, color: "text-destructive" },
  ];

  const afterSalesStats = [
    { label: "Litiges", value: (disputeStats?.total ?? 0).toString(), icon: ShieldAlert, color: "text-destructive", sub: `${disputeStats?.open ?? 0} ouvert(s)` },
    { label: "Retours", value: (returnStats?.total ?? 0).toString(), icon: RotateCcw, color: "text-amber-500", sub: `${returnStats?.pending ?? 0} en attente` },
    { label: "Paiements réussis", value: (paymentStats?.successful ?? 0).toString(), icon: CreditCard, color: "text-primary", sub: `$${(paymentStats?.totalAmount ?? 0).toLocaleString()}` },
    { label: "Paiements échoués", value: (paymentStats?.failed ?? 0).toString(), icon: AlertTriangle, color: "text-destructive", sub: `${paymentStats?.pending ?? 0} en attente` },
  ];

  const logisticsStats = [
    { label: "Expéditions", value: (shipmentStats?.total ?? 0).toString(), icon: Ship },
    { label: "Livraisons totales", value: (deliverySummary?.total ?? 0).toString(), icon: Truck },
    { label: "Livrées", value: (deliverySummary?.delivered ?? 0).toString(), icon: TrendingUp },
    { label: "En cours", value: (deliverySummary?.inProgress ?? 0).toString(), icon: Bike },
  ];

  const roleLabels: Record<string, string> = {
    vendor: "Vendeurs", shipper: "Transporteurs", rider: "Livreurs", manager: "Managers", admin: "Admins",
  };
  const roleColors: Record<string, string> = {
    vendor: "bg-primary", shipper: "bg-blue-500", rider: "bg-amber-500", manager: "bg-purple-500", admin: "bg-destructive",
  };

  const orderStatusEntries = Object.entries(orderStats?.byStatus ?? {});
  const shipmentModeLabels: Record<string, string> = { loading: "Chargement", in_transit: "En transit", customs: "Douanes", arrived: "Arrivé", delivered: "Livré" };

  const vendorCount = roleCounts.find(r => r.role === "vendor")?.count ?? 0;
  const riderCount = roleCounts.find(r => r.role === "rider")?.count ?? 0;

  return (
    <AdminLayout title="Tableau de bord">
      {/* ── Section 1: Commerce ── */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Commerce</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {commerceStats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <s.icon size={20} className={s.color} />
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? "..." : s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Section 2: Santé des commandes ── */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Santé des commandes</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {orderHealthStats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center`}>
              <s.icon size={20} className={s.color} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{loading ? "..." : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 3: Après-vente & Paiements ── */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Après-vente & Paiements</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {afterSalesStats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={18} className={s.color} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            {s.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Section 4: Logistique ── */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Logistique & Livraison</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {logisticsStats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <s.icon size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 5: Acteurs clés ── */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Acteurs de la plateforme</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <StoreIcon size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{vendorCount}</p>
            <p className="text-xs text-muted-foreground">Vendeurs inscrits</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Bike size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{riderCount}</p>
            <p className="text-xs text-muted-foreground">Livreurs actifs</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <UserCheck size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{profileCount}</p>
            <p className="text-xs text-muted-foreground">Clients inscrits</p>
          </div>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Évolution des livraisons (14 jours)</h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deliveryChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(40, 80%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(40, 80%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                <Area type="monotone" dataKey="delivered" name="Livrées" stroke="hsl(var(--primary))" fill="url(#gradDelivered)" strokeWidth={2} />
                <Area type="monotone" dataKey="pending" name="En attente" stroke="hsl(40, 80%, 50%)" fill="url(#gradPending)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Expéditions par mode</h2>
          {(shipmentStats?.byMode ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune expédition</p>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={shipmentStats?.byMode ?? []} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {(shipmentStats?.byMode ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Shipment status bar chart ── */}
      {(shipmentStats?.byStatus ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Statuts des expéditions</h2>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(shipmentStats?.byStatus ?? []).map((s) => ({ ...s, name: shipmentModeLabels[s.name] || s.name }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name="Expéditions" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Bottom grid: Recent orders + sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                      <td className="py-2.5 text-right text-muted-foreground text-xs">
                        {format(new Date(o.created_at), "d MMM", { locale: fr })}
                      </td>
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
            {roleCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun rôle attribué</p>
            ) : (
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
    </AdminLayout>
  );
}
