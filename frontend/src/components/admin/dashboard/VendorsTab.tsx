import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { StoreIcon, TrendingUp } from "lucide-react";
import { TOOLTIP_STYLE, KpiCardRow } from "./shared";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";

interface Props { period: PeriodKey; }

export function VendorsTab({ period }: Props) {
  const since = getPeriodDate(period).toISOString();

  // Fetch orders with store info
  const { data: vendorData } = useQuery({
    queryKey: ["admin-vendors-tab", period],
    queryFn: async () => {
      // Orders in period with store_id
      const { data: orders } = await supabase
        .from("orders")
        .select("total, status, store_id")
        .gte("created_at", since)
        .not("store_id", "is", null);

      // All stores
      const { data: stores } = await supabase.from("stores").select("id, name, products_count, rating, created_at");

      if (!orders || !stores) return { topByRevenue: [], topByCount: [], table: [], totalVendors: 0, newStores: 0 };

      const storeMap = new Map(stores.map(s => [s.id, s]));

      // Aggregate by store
      const agg: Record<string, { revenue: number; count: number }> = {};
      orders.forEach((o) => {
        if (!o.store_id) return;
        if (!agg[o.store_id]) agg[o.store_id] = { revenue: 0, count: 0 };
        agg[o.store_id].count++;
        if (o.status !== "cancelled" && o.status !== "returned") agg[o.store_id].revenue += Number(o.total);
      });

      const entries = Object.entries(agg).map(([id, d]) => {
        const store = storeMap.get(id);
        return { id, name: store?.name || "Boutique inconnue", revenue: Math.round(d.revenue), count: d.count, products: store?.products_count ?? 0, rating: store?.rating ?? 0 };
      });

      const topByRevenue = [...entries].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      const topByCount = [...entries].sort((a, b) => b.count - a.count).slice(0, 10);
      const table = [...entries].sort((a, b) => b.revenue - a.revenue).slice(0, 20);

      const newStores = stores.filter(s => new Date(s.created_at) >= getPeriodDate(period)).length;

      return { topByRevenue, topByCount, table, totalVendors: stores.length, newStores };
    },
  });

  const { topByRevenue = [], topByCount = [], table = [], totalVendors = 0, newStores = 0 } = vendorData ?? {};

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardRow icon={StoreIcon} label="Boutiques totales" value={totalVendors.toString()} />
        <KpiCardRow icon={TrendingUp} label="Nouvelles boutiques" value={newStores.toString()} color="text-primary" />
      </div>

      {/* Top by revenue */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 vendeurs par chiffre d'affaires</h2>
        <div className="h-[300px]">
          {topByRevenue.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topByRevenue} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" width={120} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, "CA"]} />
                <Bar dataKey="revenue" name="CA ($)" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top by orders */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 vendeurs par nombre de commandes</h2>
        <div className="h-[300px]">
          {topByCount.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topByCount} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" width={120} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Commandes" fill="hsl(210, 70%, 50%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Rankings table */}
      {table.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Classement vendeurs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 font-medium">#</th>
                  <th className="text-left pb-2 font-medium">Boutique</th>
                  <th className="text-right pb-2 font-medium">CA ($)</th>
                  <th className="text-right pb-2 font-medium">Commandes</th>
                  <th className="text-right pb-2 font-medium">Produits</th>
                  <th className="text-right pb-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {table.map((v, i) => (
                  <tr key={v.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 font-medium">{v.name}</td>
                    <td className="py-2.5 text-right font-semibold">${v.revenue.toLocaleString()}</td>
                    <td className="py-2.5 text-right">{v.count}</td>
                    <td className="py-2.5 text-right">{v.products}</td>
                    <td className="py-2.5 text-right">{v.rating ? `${v.rating}/5` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
