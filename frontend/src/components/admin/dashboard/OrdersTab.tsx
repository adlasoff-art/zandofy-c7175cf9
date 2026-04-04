import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Package, DollarSign, TrendingUp, CreditCard, Users, Gift, Search, ChevronDown, ChevronRight } from "lucide-react";
import { PIE_COLORS, TOOLTIP_STYLE } from "./shared";
import { Badge } from "@/components/ui/badge";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";
import type { GlobalFilters } from "./DashboardGlobalFilters";

interface Props { period: PeriodKey; geoFilters?: GlobalFilters; }

const GATEWAY_RATES: Record<string, number> = {
  mobile_money: 2.5, stripe: 3.5, card: 3.5, paypal: 3.9, cod: 0, off_platform: 0,
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OrdersTab({ period, geoFilters }: Props) {
  const sinceDate = getPeriodDate(period);
  const since = sinceDate?.toISOString() ?? new Date(0).toISOString();
  const country = geoFilters?.country !== "all" ? geoFilters?.country : undefined;
  const city = geoFilters?.city !== "all" ? geoFilters?.city : undefined;
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch orders
  const { data: orders = [] } = useQuery({
    queryKey: ["dashboard-orders-detail", period, country, city],
    queryFn: async () => {
      let q = (supabase as any)
        .from("orders")
        .select("id, order_ref, status, store_id, created_at, subtotal, total, payment_method, discount_amount, coupon_code, shipping_cost, last_mile_fee, shipping_city, shipping_country")
        .gte("created_at", since);
      if (country) q = q.eq("shipping_country", country);
      if (city) q = q.eq("shipping_city", city);
      const { data } = await q.order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  // Fetch order items
  const { data: allItems = [] } = useQuery({
    queryKey: ["dashboard-orders-items", period, country, city],
    queryFn: async () => {
      if (!orders.length) return [];
      const ids = orders.map((o: any) => o.id);
      const batched: any[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const { data } = await (supabase as any).from("order_items").select("order_id, product_id, product_name, price, quantity").in("order_id", ids.slice(i, i + 500));
        if (data) batched.push(...data);
      }
      return batched;
    },
    enabled: orders.length > 0,
  });

  // Products with costs
  const { data: products = [] } = useQuery({
    queryKey: ["dashboard-orders-products"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("products").select("id, cost_real, cost_calc, vendor_extra_margin, name");
      return data || [];
    },
  });

  // Stores
  const { data: stores = [] } = useQuery({
    queryKey: ["dashboard-orders-stores"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("stores").select("id, name");
      return data || [];
    },
  });

  // Referral deductions
  const { data: referralTxns = [] } = useQuery({
    queryKey: ["dashboard-orders-referrals", period],
    queryFn: async () => {
      let q = (supabase as any).from("point_transactions").select("order_id, amount").not("referral_id", "is", null).in("type", ["earned", "pending"]);
      if (sinceDate) q = q.gte("created_at", since);
      const { data } = await q;
      return data || [];
    },
  });

  const enrichedOrders = useMemo(() => {
    const productMap = new Map(products.map((p: any) => [p.id, p]));
    const storeMap = new Map(stores.map((s: any) => [s.id, s]));
    const itemsByOrder = new Map<string, any[]>();
    allItems.forEach((item: any) => {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder.get(item.order_id)!.push(item);
    });
    const refByOrder = new Map<string, number>();
    referralTxns.forEach((t: any) => {
      if (t.order_id) refByOrder.set(t.order_id, (refByOrder.get(t.order_id) || 0) + Math.abs(Number(t.amount)));
    });

    return orders
      .filter((o: any) => !search || o.order_ref?.toLowerCase().includes(search.toLowerCase()))
      .map((o: any) => {
        const items = itemsByOrder.get(o.id) || [];
        const method = o.payment_method || "unknown";
        const gatewayPct = GATEWAY_RATES[method] ?? 0;
        const discount = Number(o.discount_amount || 0);
        const referral = refByOrder.get(o.id) || 0;

        let revenue = 0, costReal = 0, costCalc = 0;
        const enrichedItems = items.map((item: any) => {
          const product = productMap.get(item.product_id);
          const qty = item.quantity || 1;
          const rev = (item.price || 0) * qty;
          const cr = (product?.cost_real || 0) * qty;
          const cc = (product?.cost_calc || 0) * qty;
          revenue += rev;
          costReal += cr;
          costCalc += cc;
          return { ...item, costReal: product?.cost_real || 0, costCalc: product?.cost_calc || 0, revenue: rev };
        });

        const gatewayFee = revenue * (gatewayPct / 100);
        const grossMargin = revenue - costReal - gatewayFee;
        const netMargin = grossMargin - referral - discount;

        return {
          ...o,
          storeName: storeMap.get(o.store_id)?.name || "—",
          items: enrichedItems,
          revenue,
          costReal,
          costCalc,
          costSpread: costCalc - costReal,
          gatewayPct,
          gatewayFee,
          referral,
          loyaltyDiscount: discount,
          grossMargin,
          grossMarginPct: revenue > 0 ? (grossMargin / revenue) * 100 : 0,
          netMargin,
          netMarginPct: revenue > 0 ? (netMargin / revenue) * 100 : 0,
        };
      });
  }, [orders, allItems, products, stores, referralTxns, search]);

  // Summary KPIs
  const totals = useMemo(() => {
    const delivered = enrichedOrders.filter((o: any) => o.status === "delivered");
    return {
      totalOrders: enrichedOrders.length,
      deliveredOrders: delivered.length,
      totalRevenue: delivered.reduce((s: number, o: any) => s + o.revenue, 0),
      totalCostReal: delivered.reduce((s: number, o: any) => s + o.costReal, 0),
      totalGateway: delivered.reduce((s: number, o: any) => s + o.gatewayFee, 0),
      totalReferral: delivered.reduce((s: number, o: any) => s + o.referral, 0),
      totalLoyalty: delivered.reduce((s: number, o: any) => s + o.loyaltyDiscount, 0),
      grossMargin: delivered.reduce((s: number, o: any) => s + o.grossMargin, 0),
      netMargin: delivered.reduce((s: number, o: any) => s + o.netMargin, 0),
    };
  }, [enrichedOrders]);

  // Margin distribution pie
  const marginDistribution = useMemo(() => {
    const buckets = { "< 0%": 0, "0-10%": 0, "10-20%": 0, "20-30%": 0, "> 30%": 0 };
    enrichedOrders.filter((o: any) => o.status === "delivered").forEach((o: any) => {
      if (o.netMarginPct < 0) buckets["< 0%"]++;
      else if (o.netMarginPct < 10) buckets["0-10%"]++;
      else if (o.netMarginPct < 20) buckets["10-20%"]++;
      else if (o.netMarginPct < 30) buckets["20-30%"]++;
      else buckets["> 30%"]++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value })).filter(b => b.value > 0);
  }, [enrichedOrders]);

  const statusLabels: Record<string, string> = {
    pending: "En attente", confirmed: "Confirmée", preparing: "Préparation",
    in_shipping: "Expédition", shipped: "Hub", delivered: "Livrée",
    cancelled: "Annulée", returned: "Retournée",
  };

  const methodLabels: Record<string, string> = {
    stripe: "Carte", mobile_money: "MoMo", cod: "COD", off_platform: "Hors pl.", paypal: "PayPal",
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: "Commandes totales", value: totals.totalOrders.toString(), icon: Package, color: "text-primary" },
          { label: "CA livré", value: `$${fmt(totals.totalRevenue)}`, icon: DollarSign, color: "text-emerald-600", sub: `${totals.deliveredOrders} livrées` },
          { label: "Marge brute", value: `$${fmt(totals.grossMargin)}`, icon: TrendingUp, color: "text-emerald-600", sub: totals.totalRevenue > 0 ? `${((totals.grossMargin / totals.totalRevenue) * 100).toFixed(1)}%` : "—" },
          { label: "Frais passerelle", value: `−$${fmt(totals.totalGateway)}`, icon: CreditCard, color: "text-red-500" },
          { label: "Marge nette", value: `$${fmt(totals.netMargin)}`, icon: TrendingUp, color: totals.netMargin >= 0 ? "text-emerald-600" : "text-destructive", sub: totals.totalRevenue > 0 ? `${((totals.netMargin / totals.totalRevenue) * 100).toFixed(1)}%` : "—" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <kpi.icon size={14} className={kpi.color} />
              <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-sm font-bold text-foreground">{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Deductions summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2">
          <Users size={14} className="text-violet-600" />
          <div>
            <p className="text-[10px] text-muted-foreground">Parrainage</p>
            <p className="text-sm font-bold text-foreground">−${fmt(totals.totalReferral)}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2">
          <Gift size={14} className="text-pink-600" />
          <div>
            <p className="text-[10px] text-muted-foreground">Fidélité</p>
            <p className="text-sm font-bold text-foreground">−${fmt(totals.totalLoyalty)}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2">
          <CreditCard size={14} className="text-red-500" />
          <div>
            <p className="text-[10px] text-muted-foreground">Passerelle</p>
            <p className="text-sm font-bold text-foreground">−${fmt(totals.totalGateway)}</p>
          </div>
        </div>
      </div>

      {/* Margin distribution pie */}
      {marginDistribution.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Répartition des marges nettes par commande</h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={marginDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {marginDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Search + Order list */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-foreground flex-1">Détail par commande</h2>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Réf. commande..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 w-40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-2 w-5" />
                <th className="text-left py-2 pr-3">Réf.</th>
                <th className="text-left py-2 px-2">Boutique</th>
                <th className="text-left py-2 px-2">Statut</th>
                <th className="text-left py-2 px-2">Paiement</th>
                <th className="text-right py-2 px-2">CA</th>
                <th className="text-right py-2 px-2">Coût</th>
                <th className="text-right py-2 px-2">Passerelle</th>
                <th className="text-right py-2 px-2">M. brute</th>
                <th className="text-right py-2 px-2">Déductions</th>
                <th className="text-right py-2 px-2">M. nette</th>
              </tr>
            </thead>
            <tbody>
              {enrichedOrders.slice(0, 100).map((o: any) => (
                <>
                  <tr
                    key={o.id}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                  >
                    <td className="py-1.5 pr-1">
                      {o.items.length > 0 && (
                        expandedId === o.id
                          ? <ChevronDown size={10} className="text-muted-foreground" />
                          : <ChevronRight size={10} className="text-muted-foreground" />
                      )}
                    </td>
                    <td className="py-1.5 pr-3 font-medium text-primary">{o.order_ref}</td>
                    <td className="py-1.5 px-2 truncate max-w-[120px]">{o.storeName}</td>
                    <td className="py-1.5 px-2">
                      <Badge variant={o.status === "delivered" ? "default" : o.status === "cancelled" ? "destructive" : "secondary"} className="text-[8px]">
                        {statusLabels[o.status] || o.status}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-2">
                      <Badge variant="outline" className="text-[8px]">
                        {methodLabels[o.payment_method] || o.payment_method || "—"}
                        {o.gatewayPct > 0 && ` (${o.gatewayPct}%)`}
                      </Badge>
                    </td>
                    <td className="text-right py-1.5 px-2 font-medium">${fmt(o.revenue)}</td>
                    <td className="text-right py-1.5 px-2">${fmt(o.costReal)}</td>
                    <td className="text-right py-1.5 px-2 text-destructive">
                      {o.gatewayFee > 0 ? `−$${fmt(o.gatewayFee)}` : "—"}
                    </td>
                    <td className="text-right py-1.5 px-2">
                      ${fmt(o.grossMargin)}
                      <span className={`ml-0.5 text-[8px] ${o.grossMarginPct >= 15 ? "text-emerald-600" : o.grossMarginPct >= 0 ? "text-amber-600" : "text-destructive"}`}>
                        ({o.grossMarginPct.toFixed(0)}%)
                      </span>
                    </td>
                    <td className="text-right py-1.5 px-2 text-destructive">
                      {(o.referral + o.loyaltyDiscount) > 0 ? `−$${fmt(o.referral + o.loyaltyDiscount)}` : "—"}
                    </td>
                    <td className="text-right py-1.5 px-2 font-semibold">
                      <span className={o.netMargin >= 0 ? "text-emerald-600" : "text-destructive"}>
                        ${fmt(o.netMargin)}
                      </span>
                      <span className={`ml-0.5 text-[8px] ${o.netMarginPct >= 10 ? "text-emerald-600" : o.netMarginPct >= 0 ? "text-amber-600" : "text-destructive"}`}>
                        ({o.netMarginPct.toFixed(0)}%)
                      </span>
                    </td>
                  </tr>
                  {expandedId === o.id && (
                    <tr key={`${o.id}-detail`}>
                      <td colSpan={11} className="bg-muted/20 px-6 py-2">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                            <span>Écart coût (calc−réel): <strong className="text-foreground">${fmt(o.costSpread)}</strong></span>
                            {o.referral > 0 && <span>Parrainage: <strong className="text-violet-600">−${fmt(o.referral)}</strong></span>}
                            {o.loyaltyDiscount > 0 && <span>Fidélité: <strong className="text-pink-600">−${fmt(o.loyaltyDiscount)}</strong></span>}
                            {o.coupon_code && <span>Coupon: <strong className="text-primary">{o.coupon_code}</strong></span>}
                          </div>
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="border-b border-border/50 text-muted-foreground">
                                <th className="text-left py-1">Produit</th>
                                <th className="text-right py-1">Qté</th>
                                <th className="text-right py-1">Prix</th>
                                <th className="text-right py-1">Coût réel</th>
                                <th className="text-right py-1">Coût calcul</th>
                                <th className="text-right py-1">Écart</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.items.map((item: any, idx: number) => (
                                <tr key={idx} className="border-b border-border/30">
                                  <td className="py-0.5 truncate max-w-[180px]">{item.product_name}</td>
                                  <td className="text-right py-0.5">{item.quantity}</td>
                                  <td className="text-right py-0.5">${fmt(item.price)}</td>
                                  <td className="text-right py-0.5">${fmt(item.costReal)}</td>
                                  <td className="text-right py-0.5">${fmt(item.costCalc)}</td>
                                  <td className="text-right py-0.5">${fmt(item.costCalc - item.costReal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {enrichedOrders.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune commande pour cette période</p>
        )}
      </div>
    </div>
  );
}
