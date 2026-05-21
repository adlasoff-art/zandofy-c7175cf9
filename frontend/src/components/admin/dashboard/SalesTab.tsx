import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, AreaChart, ComposedChart, Line, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PIE_COLORS, TOOLTIP_STYLE, statusLabels } from "./shared";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";
import type { GlobalFilters } from "./DashboardGlobalFilters";

interface Props { period: PeriodKey; geoFilters?: GlobalFilters; }

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FAILED_STATUSES = ["payment_failed", "cancelled", "returned"] as const;
const isFailedOrder = (s: string) => FAILED_STATUSES.includes(s as any);
const isValidOrder = (s: string) => !isFailedOrder(s) && s !== "awaiting_payment";

export function SalesTab({ period, geoFilters }: Props) {
  const sinceDate = getPeriodDate(period) ?? new Date(new Date().getFullYear() - 5, 0, 1);
  const since = sinceDate.toISOString();
  const country = geoFilters?.country !== "all" ? geoFilters?.country : undefined;
  const city = geoFilters?.city !== "all" ? geoFilters?.city : undefined;

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-sales-orders", period, country, city],
    queryFn: async () => {
      let q = (supabase as any).from("orders").select("total, subtotal, status, created_at, payment_method, shipping_country, shipping_city, store_id, discount_amount").gte("created_at", since);
      if (country) q = q.eq("shipping_country", country);
      if (city) q = q.eq("shipping_city", city);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Stores for vendor breakdown
  const { data: stores = [] } = useQuery({
    queryKey: ["admin-sales-stores"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("stores").select("id, name");
      return data || [];
    },
  });

  const dailySales = useMemo(() => {
    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    const map: Record<string, { date: string; revenue: number; validCount: number; failedCount: number }> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }), revenue: 0, validCount: 0, failedCount: 0 };
    });
    orders.forEach((o: any) => {
      const key = format(new Date(o.created_at), "yyyy-MM-dd");
      if (map[key]) {
        if (isFailedOrder(o.status)) {
          map[key].failedCount++;
        } else if (isValidOrder(o.status)) {
          map[key].validCount++;
          map[key].revenue += Number(o.total);
        }
      }
    });
    return Object.values(map);
  }, [orders, sinceDate]);

  const cumulativeRevenue = useMemo(() => {
    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    const map: Record<string, { date: string; valid: number; failed: number }> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }), valid: 0, failed: 0 };
    });
    orders.forEach((o: any) => {
      const key = format(new Date(o.created_at), "yyyy-MM-dd");
      if (!map[key]) return;
      const t = Number(o.total) || 0;
      if (isFailedOrder(o.status)) map[key].failed += t;
      else if (isValidOrder(o.status)) map[key].valid += t;
    });
    let cumValid = 0, cumFailed = 0;
    return Object.values(map).map((d) => {
      cumValid += d.valid;
      cumFailed += d.failed;
      return {
        date: d.date,
        cumValid: Math.round(cumValid * 100) / 100,
        cumFailed: Math.round(cumFailed * 100) / 100,
        cumGross: Math.round((cumValid + cumFailed) * 100) / 100,
      };
    });
  }, [orders, sinceDate]);

  const statusPie = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o: any) => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: statusLabels[name] || name, value }));
  }, [orders]);

  const paymentPie = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o: any) => {
      const method = o.payment_method || "Non spécifié";
      map[method] = (map[method] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name === "stripe" ? "Carte (Stripe)" : name === "mobile_money" ? "Mobile Money" : name === "cod" ? "Paiement à la livraison" : name === "off_platform" ? "Hors plateforme" : name === "paypal" ? "PayPal" : name,
      value,
    }));
  }, [orders]);

  // CA cumulé par vendeur (top 10) — séparé validé / échoué
  const vendorCumulatives = useMemo(() => {
    const storeMap = new Map<string, string>(stores.map((s: any) => [s.id as string, s.name as string]));
    const agg: Record<string, { valid: number; failed: number }> = {};
    orders.forEach((o: any) => {
      if (!o.store_id) return;
      const name = storeMap.get(o.store_id as string) || "Inconnu";
      if (!agg[name]) agg[name] = { valid: 0, failed: 0 };
      const t = Number(o.total) || 0;
      if (isFailedOrder(o.status)) agg[name].failed += t;
      else if (isValidOrder(o.status)) agg[name].valid += t;
    });
    return Object.entries(agg)
      .sort((a, b) => (b[1].valid + b[1].failed) - (a[1].valid + a[1].failed))
      .slice(0, 10)
      .map(([name, v]) => ({
        name: name.length > 18 ? name.slice(0, 18) + "…" : name,
        valid: Math.round(v.valid * 100) / 100,
        failed: Math.round(v.failed * 100) / 100,
      }));
  }, [orders, stores]);

  // Revenue by vendor daily (top 5 for stacked chart)
  const vendorDailyData = useMemo(() => {
    const storeMap = new Map<string, string>(stores.map((s: any) => [s.id as string, s.name as string]));
    const storeRevByDay: Record<string, Record<string, number>> = {};
    const storeNames = new Set<string>();

    orders.forEach((o: any) => {
      if (!o.store_id || !isValidOrder(o.status)) return;
      const day = format(new Date(o.created_at), "yyyy-MM-dd");
      const name = storeMap.get(o.store_id as string) || "Inconnu";
      storeNames.add(name);
      if (!storeRevByDay[day]) storeRevByDay[day] = {};
      storeRevByDay[day][name] = (storeRevByDay[day][name] || 0) + Number(o.total);
    });

    // Get top 5 stores by total revenue
    const storeTotals: Record<string, number> = {};
    Object.values(storeRevByDay).forEach(dayData => {
      Object.entries(dayData).forEach(([name, rev]) => {
        storeTotals[name] = (storeTotals[name] || 0) + rev;
      });
    });
    const top5 = Object.entries(storeTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);

    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    return {
      data: days.map(d => {
        const key = format(d, "yyyy-MM-dd");
        const entry: any = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }) };
        top5.forEach(name => { entry[name] = storeRevByDay[key]?.[name] || 0; });
        return entry;
      }),
      storeNames: top5,
    };
  }, [orders, stores, sinceDate]);

  return (
    <div className="space-y-6">
      {/* Daily sales */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Ventes par jour (revenu & nombre)</h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySales} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval={Math.max(0, Math.floor(dailySales.length / 15))} />
              <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="revenue" name="Revenu validé ($)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="validCount" name="Commandes valides" fill="hsl(210, 70%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="failedCount" name="Échouées / annulées" fill="hsl(0, 75%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cumulative CA */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Évolution du chiffre d'affaires (cumulatif)</h2>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cumulativeRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradValid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 70%, 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 70%, 40%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval={Math.max(0, Math.floor(cumulativeRevenue.length / 15))} />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`$${Number(v).toLocaleString()}`, n]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="cumValid" name="CA validé (perçu)" stroke="hsl(142, 70%, 40%)" fill="url(#gradValid)" strokeWidth={2} />
              <Line type="monotone" dataKey="cumFailed" name="Échoué / annulé" stroke="hsl(0, 75%, 55%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cumGross" name="Brut (tout cumulé)" stroke="hsl(0, 0%, 55%)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vendor cumulative revenue */}
      {vendorCumulatives.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">CA cumulé par vendeur (Top 10)</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorCumulatives} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" width={130} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`$${fmt(v)}`, n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="valid" name="Validé" fill="hsl(142, 70%, 40%)" radius={[0, 6, 6, 0]} />
                <Bar dataKey="failed" name="Échoué / annulé" fill="hsl(0, 75%, 55%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Vendor daily stacked (top 5) */}
      {vendorDailyData.storeNames.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Évolution par vendeur (Top 5)</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vendorDailyData.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval={Math.max(0, Math.floor(vendorDailyData.data.length / 15))} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `$${fmt(v)}`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                {vendorDailyData.storeNames.map((name, i) => (
                  <Area key={name} type="monotone" dataKey={name} stackId="1" stroke={PIE_COLORS[i % PIE_COLORS.length]} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.4} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Status + Payment pies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Répartition par statut</h2>
          <div className="h-[250px]">
            {statusPie.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Modes de paiement</h2>
          <div className="h-[250px]">
            {paymentPie.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentPie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {paymentPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
