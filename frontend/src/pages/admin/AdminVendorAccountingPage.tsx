import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Store, ChevronDown, ChevronRight, Building2, User2, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Period = "7d" | "14d" | "30d" | "3m" | "6m" | "1y" | "all";

const periodOptions: { value: Period; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "14d", label: "14 jours" },
  { value: "30d", label: "30 jours" },
  { value: "3m", label: "3 mois" },
  { value: "6m", label: "6 mois" },
  { value: "1y", label: "1 an" },
  { value: "all", label: "Tout" },
];

function getSinceDate(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case "7d": now.setDate(now.getDate() - 7); break;
    case "14d": now.setDate(now.getDate() - 14); break;
    case "30d": now.setDate(now.getDate() - 30); break;
    case "3m": now.setMonth(now.getMonth() - 3); break;
    case "6m": now.setMonth(now.getMonth() - 6); break;
    case "1y": now.setFullYear(now.getFullYear() - 1); break;
    case "all": return null;
  }
  return now.toISOString();
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminVendorAccountingPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [search, setSearch] = useState("");
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const since = getSinceDate(period);

  // Fetch all stores with platform flag
  const { data: stores } = useQuery({
    queryKey: ["accounting-stores"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stores")
        .select("id, name, owner_id, is_platform_owned")
        .order("name");
      return (data || []) as { id: string; name: string; owner_id: string; is_platform_owned: boolean }[];
    },
  });
    },
  });

  // Fetch vendor pricing overrides (commission rates)
  const { data: overrides } = useQuery({
    queryKey: ["accounting-overrides"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("store_id, commission_rate, vendor_extra_margin_enabled");
      return data || [];
    },
  });

  // Fetch global default commission
  const { data: globalDefaults } = useQuery({
    queryKey: ["pricing-defaults-accounting"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "pricing_defaults")
        .single();
      return data?.value as any || {};
    },
  });

  // Fetch delivered order items for the period
  const { data: orderItems, isLoading } = useQuery({
    queryKey: ["accounting-items", period],
    queryFn: async () => {
      let q = supabase
        .from("order_items")
        .select("id, order_id, product_id, product_name, price, quantity, orders!inner(id, status, store_id, created_at, subtotal, order_ref)")
        .eq("orders.status", "delivered");

      if (since) {
        q = q.gte("orders.created_at", since);
      }

      const { data } = await q.limit(5000);
      return data || [];
    },
  });

  // Fetch products for cost_real and vendor_extra_margin
  const { data: products } = useQuery({
    queryKey: ["accounting-products"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products")
        .select("id, cost_real, vendor_extra_margin, store_id, name");
      return (data || []) as { id: string; cost_real: number | null; vendor_extra_margin: number | null; store_id: string | null; name: string }[];
    },
  });

  // Fetch vendor wallets
  const { data: wallets } = useQuery({
    queryKey: ["accounting-wallets"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendor_wallets")
        .select("store_id, available_balance, pending_balance, total_earned");
      return data || [];
    },
  });

  // Compute store accounting data
  const storeAccounting = useMemo(() => {
    if (!stores || !orderItems || !products || !overrides) return [];

    const productMap = new Map(products.map((p) => [p.id, p]));
    const overrideMap = new Map((overrides as any[]).map((o: any) => [o.store_id, o]));
    const walletMap = new Map((wallets || []).map((w: any) => [w.store_id, w]));
    const defaultCommission = Number(globalDefaults?.platform_commission_default) || 10;

    // Group items by store
    const storeItemsMap = new Map<string, any[]>();
    for (const item of orderItems as any[]) {
      const storeId = item.orders?.store_id;
      if (!storeId) continue;
      if (!storeItemsMap.has(storeId)) storeItemsMap.set(storeId, []);
      storeItemsMap.get(storeId)!.push(item);
    }

    return (stores as any[])
      .filter((s: any) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
      .map((store: any) => {
        const items = storeItemsMap.get(store.id) || [];
        const override = overrideMap.get(store.id) as any;
        const wallet = walletMap.get(store.id) as any;
        const isPlatform = (store as any).is_platform_owned || false;
        const commissionRate = isPlatform ? 0 : Number(override?.commission_rate) || defaultCommission;
        const extraMarginEnabled = override?.vendor_extra_margin_enabled ?? false;

        let totalRevenue = 0;
        let totalCost = 0;
        let totalVendorMargin = 0;
        const productDetails: any[] = [];

        for (const item of items) {
          const product = productMap.get(item.product_id);
          const qty = item.quantity || 1;
          const revenue = (item.price || 0) * qty;
          const costReal = (product?.cost_real || 0) * qty;
          const vendorMargin = extraMarginEnabled ? (product?.vendor_extra_margin || 0) * qty : 0;

          totalRevenue += revenue;
          totalCost += costReal;
          totalVendorMargin += vendorMargin;

          productDetails.push({
            productId: item.product_id,
            productName: item.product_name || product?.name || "—",
            quantity: qty,
            unitPrice: item.price || 0,
            unitCost: product?.cost_real || 0,
            unitVendorMargin: extraMarginEnabled ? (product?.vendor_extra_margin || 0) : 0,
            revenue,
            cost: costReal,
            vendorMargin,
          });
        }

        const platformCommission = totalRevenue * (commissionRate / 100);
        const platformMargin = totalRevenue - totalCost - totalVendorMargin;
        const netDueVendor = isPlatform
          ? totalVendorMargin // Platform stores: only bonus
          : totalRevenue - platformCommission; // Independent: CA - commission

        return {
          id: store.id,
          name: store.name,
          isPlatform,
          commissionRate,
          totalRevenue,
          totalCost,
          totalVendorMargin,
          platformCommission,
          platformMargin,
          netDueVendor,
          ordersCount: items.length,
          walletAvailable: wallet?.available_balance || 0,
          walletPending: wallet?.pending_balance || 0,
          productDetails,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [stores, orderItems, products, overrides, wallets, globalDefaults, search]);

  // Top 10 chart data
  const top10Data = useMemo(() => {
    return storeAccounting.slice(0, 10).map((s) => ({
      name: s.name.length > 15 ? s.name.slice(0, 15) + "…" : s.name,
      CA: Math.round(s.totalRevenue * 100) / 100,
      Marge: Math.round(s.platformMargin * 100) / 100,
    }));
  }, [storeAccounting]);

  // Summary KPIs
  const totals = useMemo(() => {
    return storeAccounting.reduce(
      (acc, s) => ({
        revenue: acc.revenue + s.totalRevenue,
        cost: acc.cost + s.totalCost,
        vendorMargin: acc.vendorMargin + s.totalVendorMargin,
        commission: acc.commission + s.platformCommission,
        netDue: acc.netDue + s.netDueVendor,
        platformStores: acc.platformStores + (s.isPlatform ? 1 : 0),
        independentStores: acc.independentStores + (s.isPlatform ? 0 : 1),
      }),
      { revenue: 0, cost: 0, vendorMargin: 0, commission: 0, netDue: 0, platformStores: 0, independentStores: 0 }
    );
  }, [storeAccounting]);

  return (
    <AdminLayout title="Comptabilité vendeurs">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une boutique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {periodOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "CA livré", value: `$${fmt(totals.revenue)}`, icon: DollarSign, color: "text-emerald-600" },
            { label: "Coût achat", value: `$${fmt(totals.cost)}`, icon: TrendingUp, color: "text-orange-600" },
            { label: "Bonus vendeurs", value: `$${fmt(totals.vendorMargin)}`, icon: User2, color: "text-blue-600" },
            { label: "Commission", value: `$${fmt(totals.commission)}`, icon: DollarSign, color: "text-primary" },
            { label: "Net dû", value: `$${fmt(totals.netDue)}`, icon: DollarSign, color: "text-destructive" },
            { label: "Plateforme", value: String(totals.platformStores), icon: Building2, color: "text-primary" },
            { label: "Indépendants", value: String(totals.independentStores), icon: Store, color: "text-amber-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon size={14} className={kpi.color} />
                <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-sm font-bold text-foreground">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Top 10 Chart */}
        {top10Data.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Top 10 boutiques par CA</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={top10Data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(v: number) => `$${fmt(v)}`} />
                <Bar dataKey="CA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Marge" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Store Table */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Chargement des données...</span>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Boutique</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">CA livré</TableHead>
                  <TableHead className="text-right">Coût achat</TableHead>
                  <TableHead className="text-right">Bonus vendeur</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net dû</TableHead>
                  <TableHead className="text-right">Wallet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeAccounting.map((store) => (
                  <>
                    <TableRow
                      key={store.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                    >
                      <TableCell className="w-8">
                        {store.productDetails.length > 0 && (
                          expandedStore === store.id
                            ? <ChevronDown size={14} className="text-muted-foreground" />
                            : <ChevronRight size={14} className="text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Store size={14} className="text-primary shrink-0" />
                          <span className="text-sm font-medium">{store.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={store.isPlatform ? "default" : "secondary"} className="text-[10px]">
                          {store.isPlatform ? "Plateforme" : `Indép. (${store.commissionRate}%)`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">${fmt(store.totalRevenue)}</TableCell>
                      <TableCell className="text-right text-sm">${fmt(store.totalCost)}</TableCell>
                      <TableCell className="text-right text-sm">${fmt(store.totalVendorMargin)}</TableCell>
                      <TableCell className="text-right text-sm">${fmt(store.platformCommission)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">${fmt(store.netDueVendor)}</TableCell>
                      <TableCell className="text-right">
                        <div className="text-[10px]">
                          <span className="text-emerald-600">${fmt(store.walletAvailable)}</span>
                          {" / "}
                          <span className="text-amber-600">${fmt(store.walletPending)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedStore === store.id && store.productDetails.length > 0 && (
                      <TableRow key={`${store.id}-details`}>
                        <TableCell colSpan={9} className="p-0">
                          <div className="bg-muted/30 px-6 py-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              Détail produits — {store.name} ({store.productDetails.length} lignes)
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-1 pr-3">Produit</th>
                                    <th className="text-right py-1 px-2">Qté</th>
                                    <th className="text-right py-1 px-2">Prix unit.</th>
                                    <th className="text-right py-1 px-2">Coût unit.</th>
                                    <th className="text-right py-1 px-2">Bonus unit.</th>
                                    <th className="text-right py-1 px-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {store.productDetails.map((p: any, i: number) => (
                                    <tr key={i} className="border-b border-border/50">
                                      <td className="py-1 pr-3 max-w-[200px] truncate">{p.productName}</td>
                                      <td className="text-right py-1 px-2">{p.quantity}</td>
                                      <td className="text-right py-1 px-2">${fmt(p.unitPrice)}</td>
                                      <td className="text-right py-1 px-2">${fmt(p.unitCost)}</td>
                                      <td className="text-right py-1 px-2">${fmt(p.unitVendorMargin)}</td>
                                      <td className="text-right py-1 px-2 font-medium">${fmt(p.revenue)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {storeAccounting.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                      Aucune donnée pour cette période.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
