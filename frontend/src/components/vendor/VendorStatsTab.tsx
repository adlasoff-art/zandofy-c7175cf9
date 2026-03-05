import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, DollarSign, ShoppingBag, Package, BarChart3, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Repeat } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
} from "recharts";

interface VendorStatsTabProps {
  storeId: string;
}

type Period = "7d" | "30d" | "90d" | "365d";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "3 mois",
  "365d": "1 an",
};

const chartConfig: ChartConfig = {
  orders: { label: "Commandes", color: "hsl(var(--primary))" },
  revenue: { label: "Revenus ($)", color: "hsl(var(--primary))" },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(38, 92%, 50%)",
  confirmed: "hsl(217, 91%, 60%)",
  preparing: "hsl(48, 96%, 53%)",
  shipped: "hsl(271, 91%, 65%)",
  delivered: "hsl(142, 76%, 36%)",
  cancelled: "hsl(0, 84%, 60%)",
  returned: "hsl(350, 89%, 60%)",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmées",
  preparing: "En préparation",
  in_shipping: "En expédition",
  shipped: "Expédiées",
  delivered: "Livrées",
  cancelled: "Annulées",
  returned: "Retournées",
};

export function VendorStatsTab({ storeId }: VendorStatsTabProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [orders, setOrders] = useState<any[]>([]);
  const [prevOrders, setPrevOrders] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const daysAgo = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
      const since = new Date();
      since.setDate(since.getDate() - daysAgo);
      const prevSince = new Date();
      prevSince.setDate(prevSince.getDate() - daysAgo * 2);

      const [currentRes, prevRes, itemsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, created_at, total, status, subtotal")
          .eq("store_id", storeId)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("orders")
          .select("id, total")
          .eq("store_id", storeId)
          .gte("created_at", prevSince.toISOString())
          .lt("created_at", since.toISOString()),
        supabase
          .from("order_items")
          .select("product_name, quantity, price, order_id")
          .in(
            "order_id",
            (await supabase
              .from("orders")
              .select("id")
              .eq("store_id", storeId)
              .gte("created_at", since.toISOString())
            ).data?.map(o => o.id) || []
          ),
      ]);

      setOrders(currentRes.data || []);
      setPrevOrders(prevRes.data || []);

      // Aggregate top products
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      for (const item of (itemsRes.data || [])) {
        const key = item.product_name;
        const existing = productMap.get(key) || { quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += Number(item.price) * item.quantity;
        productMap.set(key, existing);
      }
      const sorted = Array.from(productMap, ([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setTopProducts(sorted);

      setLoading(false);
    }
    load();
  }, [storeId, period]);

  const stats = useMemo(() => {
    // Current period
    const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const totalOrders = orders.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const deliveredCount = orders.filter(o => o.status === "delivered").length;
    const cancelledCount = orders.filter(o => o.status === "cancelled" || o.status === "returned").length;
    const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 100) : 0;

    // Previous period for comparison
    const prevRevenue = prevOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const prevCount = prevOrders.length;
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = prevCount > 0 ? ((totalOrders - prevCount) / prevCount) * 100 : 0;

    // Chart data by day
    const dayMap = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      const day = new Date(o.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      const entry = dayMap.get(day) || { orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += Number(o.total) || 0;
      dayMap.set(day, entry);
    }
    const chartData = Array.from(dayMap, ([date, v]) => ({ date, ...v }));

    // Status distribution
    const statusMap = new Map<string, number>();
    for (const o of orders) {
      statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
    }
    const statusData = Array.from(statusMap, ([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || "hsl(var(--muted))",
    }));

    return {
      totalRevenue, totalOrders, avgOrder, deliveredCount, cancelledCount,
      fulfillmentRate, revenueChange, ordersChange, chartData, statusData,
    };
  }, [orders, prevOrders]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-1">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
              period === p
                ? "bg-foreground text-card border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<DollarSign size={16} />}
          value={`$${stats.totalRevenue.toFixed(0)}`}
          label="Revenus"
          change={stats.revenueChange}
        />
        <KpiCard
          icon={<ShoppingBag size={16} />}
          value={stats.totalOrders.toString()}
          label="Commandes"
          change={stats.ordersChange}
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          value={`$${stats.avgOrder.toFixed(2)}`}
          label="Panier moyen"
        />
        <KpiCard
          icon={<Package size={16} />}
          value={stats.deliveredCount.toString()}
          label="Livrées"
        />
        <KpiCard
          icon={<Repeat size={16} />}
          value={`${stats.fulfillmentRate}%`}
          label="Taux livraison"
        />
        <KpiCard
          icon={<BarChart3 size={16} />}
          value={stats.cancelledCount.toString()}
          label="Annulées"
          negative
        />
      </div>

      {stats.chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée pour cette période.</p>
      ) : (
        <>
          {/* Revenue area chart */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Évolution des revenus ($)</h3>
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#revenueGradient)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </div>

          {/* Orders bar chart */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Commandes par jour</h3>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status distribution */}
            {stats.statusData.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <PieChartIcon size={14} /> Répartition par statut
                </h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {stats.statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={({ payload }) => {
                          if (!payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded px-3 py-2 text-xs shadow-md">
                              <span className="font-medium">{d.name}</span>: {d.value}
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {stats.statusData.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      {s.name} ({s.value})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Products */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Package size={14} /> Top produits vendus
              </h3>
              {topProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Aucune vente sur cette période.</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${topProducts[0].revenue > 0 ? (p.revenue / topProducts[0].revenue) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-foreground">${p.revenue.toFixed(0)}</p>
                        <p className="text-[10px] text-muted-foreground">{p.quantity} vendus</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, value, label, change, negative }: {
  icon: React.ReactNode;
  value: string;
  label: string;
  change?: number;
  negative?: boolean;
}) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span className={`shrink-0 ${negative ? "text-destructive" : "text-primary"}`}>{icon}</span>
        <p className={`text-lg font-bold leading-none ${negative ? "text-destructive" : "text-foreground"}`}>{value}</p>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {change !== undefined && change !== 0 && (
          <span className={`flex items-center text-[9px] font-medium ${isPositive ? "text-emerald-600" : "text-destructive"}`}>
            {isPositive ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
            {Math.abs(change).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
