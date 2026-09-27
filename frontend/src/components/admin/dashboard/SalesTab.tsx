import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, ComposedChart, Line, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PIE_COLORS, TOOLTIP_STYLE, statusLabels } from "./shared";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";
import type { GlobalFilters } from "./DashboardGlobalFilters";
import { DEFAULT_GATEWAY_FEES, parseGatewayFees } from "@/lib/gateway-fees";
import { calculateAdminOrderEconomics } from "@/lib/admin-order-economics";

interface Props { period: PeriodKey; geoFilters?: GlobalFilters; }

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SalesTab({ period, geoFilters }: Props) {
  const sinceDate = getPeriodDate(period) ?? new Date(new Date().getFullYear() - 5, 0, 1);
  const since = sinceDate.toISOString();
  const country = geoFilters?.country !== "all" ? geoFilters?.country : undefined;
  const city = geoFilters?.city !== "all" ? geoFilters?.city : undefined;

  const { data: orderBuckets = [] } = useQuery({
    queryKey: ["admin-sales-order-buckets", period, country, city],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_sales_order_buckets", {
        _since: since,
        _country: country ?? null,
        _city: city ?? null,
      });
      if (!error && data) {
        return (data as any[]).map((row: any) => ({ ...row, created_at: row.day || row.created_at }));
      }
      // Fallback until RPC migration is applied
      let q = supabase
        .from("orders")
        .select("id, store_id, status, subtotal, payment_method, created_at")
        .gte("created_at", since);
      const { data: orders, error: ordErr } = await q;
      if (ordErr) throw ordErr;
      return orders || [];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["admin-sales-stores"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("stores").select("id, name, is_platform_owned");
      return data || [];
    },
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ["admin-sales-commission-settings"],
    queryFn: async () => {
      const [{ data: overrides }, { data: defaults }] = await Promise.all([
        (supabase as any).from("vendor_pricing_overrides").select("store_id, commission_rate"),
        supabase.from("platform_settings").select("value").eq("key", "pricing_defaults").maybeSingle(),
      ]);
      return {
        overrides: overrides || [],
        defaultPct: Number((defaults?.value as any)?.platform_commission_default) || 10,
      };
    },
  });

  const { data: gatewayFees = DEFAULT_GATEWAY_FEES } = useQuery({
    queryKey: ["admin-sales-gateway-fees"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "gateway_fees").maybeSingle();
      return parseGatewayFees(data?.value);
    },
  });

  const economics = useMemo(() => {
    const storesById = new Map(stores.map((store: any) => [store.id, store]));
    const overridesByStore = new Map((commissionSettings?.overrides || []).map((row: any) => [row.store_id, Number(row.commission_rate)]));
    return orderBuckets.map((order: any) => {
      const store = storesById.get(order.store_id) as any;
      const storeCommissionPct: number = store?.is_platform_owned
        ? 0
        : Number(overridesByStore.get(order.store_id) ?? commissionSettings?.defaultPct ?? 10);
      return {
        ...order,
        ...calculateAdminOrderEconomics({
          subtotal: order.subtotal,
          status: order.status,
          paymentMethod: order.payment_method,
          storeCommissionPct,
        }, gatewayFees),
      };
    });
  }, [orderBuckets, stores, commissionSettings, gatewayFees]);

  const dailySales = useMemo(() => {
    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    const map: Record<string, { date: string; gmv: number; platformCommission: number; netVendor: number; gatewayFees: number }> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }), gmv: 0, platformCommission: 0, netVendor: 0, gatewayFees: 0 };
    });
    economics.forEach((o: any) => {
      const raw = o.day || o.created_at;
      const key = typeof raw === "string" && raw.length >= 10
        ? raw.slice(0, 10)
        : format(new Date(raw), "yyyy-MM-dd");
      if (map[key]) {
        map[key].gmv += o.gmv;
        map[key].platformCommission += o.platformCommission;
        map[key].netVendor += o.netVendor;
        map[key].gatewayFees += o.gatewayFees;
      }
    });
    return Object.values(map);
  }, [economics, sinceDate]);

  const cumulativeRevenue = useMemo(() => {
    let gmv = 0, commission = 0, netVendor = 0, gatewayFees = 0;
    return dailySales.map((d) => {
      gmv += d.gmv;
      commission += d.platformCommission;
      netVendor += d.netVendor;
      gatewayFees += d.gatewayFees;
      return {
        date: d.date,
        gmv,
        platformCommission: commission,
        netVendor,
        gatewayFees,
      };
    });
  }, [dailySales]);

  const statusPie = useMemo(() => {
    const map: Record<string, number> = {};
    orderBuckets.forEach((o: any) => { map[o.status] = (map[o.status] || 0) + Number(o.order_count ?? 1); });
    return Object.entries(map).map(([name, value]) => ({ name: statusLabels[name] || name, value }));
  }, [orderBuckets]);

  const paymentPie = useMemo(() => {
    const map: Record<string, number> = {};
    orderBuckets.forEach((o: any) => {
      const method = o.payment_method || "Non spécifié";
      map[method] = (map[method] || 0) + Number(o.order_count ?? 1);
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name === "stripe" || name === "card" ? "Carte (Keccel)" : name === "mobile_money" ? "Mobile Money" : name === "cod" ? "Paiement à la livraison" : name === "off_platform" ? "Hors plateforme" : name === "whatsapp" ? "WhatsApp" : name === "paypal" ? "PayPal" : name,
      value,
    }));
  }, [orderBuckets]);

  const vendorCumulatives = useMemo(() => {
    const storeMap = new Map<string, string>(stores.map((s: any) => [s.id as string, s.name as string]));
    const agg: Record<string, { gmv: number; platformCommission: number; netVendor: number; gatewayFees: number }> = {};
    economics.forEach((o: any) => {
      if (!o.store_id) return;
      const name = storeMap.get(o.store_id as string) || "Inconnu";
      if (!agg[name]) agg[name] = { gmv: 0, platformCommission: 0, netVendor: 0, gatewayFees: 0 };
      agg[name].gmv += o.gmv;
      agg[name].platformCommission += o.platformCommission;
      agg[name].netVendor += o.netVendor;
      agg[name].gatewayFees += o.gatewayFees;
    });
    return Object.entries(agg)
      .sort((a, b) => b[1].gmv - a[1].gmv)
      .slice(0, 10)
      .map(([name, v]) => ({
        name: name.length > 18 ? name.slice(0, 18) + "…" : name,
        ...v,
      }));
  }, [economics, stores]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground">Économie des ventes par jour</h2>
        <p className="text-xs text-muted-foreground mb-4">Le net vendeur inclut la déduction des frais de passerelle.</p>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySales} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval={Math.max(0, Math.floor(dailySales.length / 15))} />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`$${fmt(v)}`, n]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="gmv" name="GMV" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="platformCommission" name="Commission plateforme" fill="hsl(40, 80%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="netVendor" name="Net vendeur" fill="hsl(142, 70%, 40%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground">Évolution cumulative</h2>
        <p className="text-xs text-muted-foreground mb-4">GMV = sous-total des commandes génératrices de revenu. Les frais de passerelle sont déduits du net vendeur.</p>
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
              <Area type="monotone" dataKey="gmv" name="GMV" stroke="hsl(var(--primary))" fill="url(#gradValid)" strokeWidth={2} />
              <Line type="monotone" dataKey="platformCommission" name="Commission plateforme" stroke="hsl(40, 80%, 50%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="netVendor" name="Net vendeur" stroke="hsl(142, 70%, 40%)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {vendorCumulatives.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground">Économie par vendeur (Top 10 GMV)</h2>
          <p className="text-xs text-muted-foreground mb-4">Le net vendeur est présenté après frais de passerelle et commission.</p>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorCumulatives} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" width={130} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`$${fmt(v)}`, n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="gmv" name="GMV" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                <Bar dataKey="platformCommission" name="Commission plateforme" fill="hsl(40, 80%, 50%)" radius={[0, 6, 6, 0]} />
                <Bar dataKey="netVendor" name="Net vendeur" fill="hsl(142, 70%, 40%)" radius={[0, 6, 6, 0]} />
              </BarChart>
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
