import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart3, Users, Eye, MousePointer, Smartphone, Monitor, Tablet,
  Globe, TrendingUp, Clock, Download, Store, Heart, ShoppingCart,
  Package, ChevronLeft, ChevronRight, ArrowUpDown, Wifi,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PERIODS = [
  { key: "24h", label: "24h", days: 1 },
  { key: "48h", label: "48h", days: 2 },
  { key: "7d", label: "7j", days: 7 },
  { key: "30d", label: "30j", days: 30 },
  { key: "90d", label: "3 mois", days: 90 },
  { key: "365d", label: "1 an", days: 365 },
  { key: "all", label: "Tout", days: 0 },
];

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon size={14} />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Daily Traffic Histogram ──────────────────────────────────────
function DailyTrafficChart({ data }: { data: { day: string; visitors: number }[] }) {
  if (data.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <BarChart3 size={14} /> Trafic journalier (visiteurs uniques)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
            className="text-muted-foreground"
            interval={data.length > 60 ? Math.floor(data.length / 15) : data.length > 14 ? 2 : 0}
          />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} className="text-muted-foreground" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            labelFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          />
          <Bar dataKey="visitors" name="Visiteurs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const formatDuration = (s: number) => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
};

// ─── Overview Tab ─────────────────────────────────────────────────
function OverviewTab({
  kpis,
  dailyTraffic,
  topProducts,
  topStores,
  topPages,
  devices,
  pwaCount,
  pwaPeriodCount,
}: {
  kpis: any;
  dailyTraffic: { day: string; visitors: number }[];
  topProducts: { product_name: string; click_count: number }[];
  topStores: { store_name: string; view_count: number }[];
  topPages: { page_path: string; view_count: number }[];
  devices: any;
  pwaCount: number;
  pwaPeriodCount: number;
}) {
  const deviceCounts = devices?.devices || {};
  const osBreakdown = devices?.os || {};
  const totalSessions = kpis?.unique_sessions || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-8 gap-2">
        <StatCard icon={Users} label="Visiteurs" value={kpis?.unique_sessions || 0} sub="sessions uniques" />
        <StatCard icon={Eye} label="Pages vues" value={kpis?.page_views || 0} />
        <StatCard icon={Users} label="Authentifiés" value={kpis?.authenticated_sessions || 0} sub="sessions connectées" />
        <StatCard icon={Globe} label="Anonymes" value={kpis?.anonymous_sessions || 0} sub="sans compte" />
        <StatCard icon={Wifi} label="En ligne" value={kpis?.online_now || 0} sub="temps réel" />
        <StatCard icon={Clock} label="Durée moy." value={formatDuration(kpis?.avg_duration || 0)} />
        <StatCard icon={Download} label="PWA installées" value={pwaCount} sub={`+${pwaPeriodCount} période`} />
        <StatCard icon={MousePointer} label="Clics produits" value={kpis?.product_clicks || 0} />
      </div>

      <DailyTrafficChart data={dailyTraffic} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Monitor size={14} /> Appareils
          </h3>
          <div className="space-y-1.5">
            {([
              { label: "Mobile", icon: Smartphone, key: "mobile" },
              { label: "Tablette", icon: Tablet, key: "tablet" },
              { label: "Ordinateur", icon: Monitor, key: "desktop" },
            ] as const).map((d) => {
              const count = deviceCounts[d.key] || 0;
              const pct = totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0;
              return (
                <div key={d.label} className="flex items-center gap-2">
                  <d.icon size={12} className="text-muted-foreground" />
                  <span className="text-xs text-foreground flex-1">{d.label}</span>
                  <span className="text-xs font-medium text-foreground">{count}</span>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Globe size={14} /> Systèmes d'exploitation
          </h3>
          <div className="space-y-1.5">
            {Object.entries(osBreakdown as Record<string, number>).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([os, count]) => {
              const pct = totalSessions > 0 ? Math.round(((count as number) / totalSessions) * 100) : 0;
              return (
                <div key={os} className="flex items-center gap-2">
                  <span className="text-xs text-foreground flex-1 capitalize">{os}</span>
                  <span className="text-xs font-medium text-foreground">{count as number}</span>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Smartphone size={14} /> Sessions PWA vs Web
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground flex-1">Sessions PWA</span>
              <span className="text-xs font-medium text-foreground">{kpis?.pwa_sessions || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground flex-1">Sessions Web</span>
              <span className="text-xs font-medium text-foreground">{kpis?.web_sessions || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp size={14} /> Pages les plus visitées
          </h3>
          <div className="space-y-1">
            {topPages.map((p, i) => (
              <div key={p.page_path} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                <span className="text-[11px] text-foreground flex-1 truncate">{p.page_path}</span>
                <span className="text-[11px] font-medium text-foreground">{p.view_count}</span>
              </div>
            ))}
            {topPages.length === 0 && <p className="text-[11px] text-muted-foreground">Aucune donnée</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <MousePointer size={14} /> Produits les plus cliqués
          </h3>
          <div className="space-y-1">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                <span className="text-[11px] text-foreground flex-1 truncate">{p.product_name}</span>
                <span className="text-[11px] font-medium text-foreground">{p.click_count} clics</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-[11px] text-muted-foreground">Aucune donnée</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Store size={14} /> Boutiques les plus visitées
          </h3>
          <div className="space-y-1">
            {topStores.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                <span className="text-[11px] text-foreground flex-1 truncate">{s.store_name}</span>
                <span className="text-[11px] font-medium text-foreground">{s.view_count} vues</span>
              </div>
            ))}
            {topStores.length === 0 && <p className="text-[11px] text-muted-foreground">Aucune donnée</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product Tracking Tab ─────────────────────────────────────────
const PAGE_SIZE = 50;

type SortField = "clicks" | "favorites" | "cart_adds" | "orders";

function ProductTrackingTab({ period, since }: { period: string; since: string | null }) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("clicks");

  const { data: allProducts } = useQuery({
    queryKey: ["analytics-products-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, store_id, product_images(image_url, position)")
        .eq("publish_status", "published")
        .order("created_at", { ascending: false })
        .limit(5000);
      return (data || []).map((p: any) => ({
        id: p.id as string,
        name: p.name as string,
        image: Array.isArray(p.product_images) && p.product_images.length > 0
          ? (p.product_images as any[]).sort((a: any, b: any) => (a.position || 0) - (b.position || 0))[0]?.image_url || null
          : null,
      }));
    },
    staleTime: 5 * 60_000,
  });

  const { data: clickEvents } = useQuery({
    queryKey: ["analytics-product-clicks", period],
    queryFn: async () => {
      let q = fromTable("analytics_events")
        .select("product_id")
        .eq("event_type", "product_click")
        .not("product_id", "is", null);
      if (since) q = q.gte("created_at", since);
      const { data } = await q.limit(50000);
      return data || [];
    },
  });

  const { data: wishlistData } = useQuery({
    queryKey: ["analytics-wishlists", period],
    queryFn: async () => {
      let q = supabase.from("wishlists").select("product_id");
      if (since) q = q.gte("created_at", since);
      const { data } = await q.limit(50000);
      return data || [];
    },
  });

  const { data: cartData } = useQuery({
    queryKey: ["analytics-cart-items", period],
    queryFn: async () => {
      let q = supabase.from("cart_items").select("product_id");
      if (since) q = q.gte("created_at", since);
      const { data } = await q.limit(50000);
      return data || [];
    },
  });

  const { data: orderItemsData } = useQuery({
    queryKey: ["analytics-order-items", period],
    queryFn: async () => {
      const { data } = await supabase.from("order_items").select("product_id, quantity, order_id").limit(50000);
      return data || [];
    },
  });

  const productStats = useMemo(() => {
    if (!allProducts) return [];

    const clickMap = new Map<string, number>();
    (clickEvents || []).forEach((e: any) => {
      if (e.product_id) clickMap.set(e.product_id, (clickMap.get(e.product_id) || 0) + 1);
    });

    const wishMap = new Map<string, number>();
    (wishlistData || []).forEach((e: any) => {
      if (e.product_id) wishMap.set(e.product_id, (wishMap.get(e.product_id) || 0) + 1);
    });

    const cartMap = new Map<string, number>();
    (cartData || []).forEach((e: any) => {
      if (e.product_id) cartMap.set(e.product_id, (cartMap.get(e.product_id) || 0) + 1);
    });

    const orderMap = new Map<string, number>();
    (orderItemsData || []).forEach((e: any) => {
      if (e.product_id) orderMap.set(e.product_id, (orderMap.get(e.product_id) || 0) + (e.quantity || 1));
    });

    return allProducts.map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      clicks: clickMap.get(p.id) || 0,
      favorites: wishMap.get(p.id) || 0,
      cart_adds: cartMap.get(p.id) || 0,
      orders: orderMap.get(p.id) || 0,
    }));
  }, [allProducts, clickEvents, wishlistData, cartData, orderItemsData]);

  const sorted = useMemo(() => {
    return [...productStats].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [productStats, sortBy]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageItems = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    setSortBy(field);
    setPage(0);
  };

  const SortHeader = ({ field, label, icon: Icon }: { field: SortField; label: string; icon: any }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
        sortBy === field ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon size={12} />
      {label}
      {sortBy === field && <ArrowUpDown size={10} />}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{sorted.length} produits actifs</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-2 w-8 text-muted-foreground font-medium">#</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Produit</th>
                <th className="p-2 text-left">
                  <SortHeader field="clicks" label="Clics" icon={MousePointer} />
                </th>
                <th className="p-2 text-left">
                  <SortHeader field="favorites" label="Favoris" icon={Heart} />
                </th>
                <th className="p-2 text-left">
                  <SortHeader field="cart_adds" label="Paniers" icon={ShoppingCart} />
                </th>
                <th className="p-2 text-left">
                  <SortHeader field="orders" label="Commandés" icon={Package} />
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p, i) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-2 text-muted-foreground">{page * PAGE_SIZE + i + 1}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {p.image ? (
                        <img src={p.image} alt="" className="w-8 h-8 rounded object-cover border border-border shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package size={12} className="text-muted-foreground" />
                        </div>
                      )}
                      <span className="truncate text-foreground font-medium max-w-[200px]">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-2 text-left font-medium text-foreground">{p.clicks}</td>
                  <td className="p-2 text-left font-medium text-foreground">{p.favorites}</td>
                  <td className="p-2 text-left font-medium text-foreground">{p.cart_adds}</td>
                  <td className="p-2 text-left font-medium text-foreground">{p.orders}</td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun produit trouvé</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Page {page + 1} / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 7 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-7 h-7 rounded text-[11px] font-medium transition-colors ${
                    page === pageNum
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const days = PERIODS.find((p) => p.key === period)?.days || 30;
  const since = days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null;

  // Backend-aggregated KPIs
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["admin-analytics-kpis", period],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_analytics_kpis", { p_since: since });
      return data as any;
    },
  });

  // Daily traffic histogram
  const { data: dailyTraffic } = useQuery({
    queryKey: ["admin-analytics-daily", period],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_analytics_daily_traffic", { p_since: since });
      return (data || []).map((d: any) => ({ day: d.day, visitors: Number(d.visitors) }));
    },
  });

  // Top products
  const { data: topProducts } = useQuery({
    queryKey: ["admin-analytics-top-products", period],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_analytics_top_products", { p_since: since });
      return (data || []).map((d: any) => ({ product_name: d.product_name, click_count: Number(d.click_count) }));
    },
  });

  // Top stores
  const { data: topStores } = useQuery({
    queryKey: ["admin-analytics-top-stores", period],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_analytics_top_stores", { p_since: since });
      return (data || []).map((d: any) => ({ store_name: d.store_name, view_count: Number(d.view_count) }));
    },
  });

  // Top pages
  const { data: topPages } = useQuery({
    queryKey: ["admin-analytics-top-pages", period],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_analytics_top_pages", { p_since: since });
      return (data || []).map((d: any) => ({ page_path: d.page_path, view_count: Number(d.view_count) }));
    },
  });

  // Device/OS breakdown
  const { data: devices } = useQuery({
    queryKey: ["admin-analytics-devices", period],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_analytics_devices", { p_since: since });
      return data as any;
    },
  });

  // PWA install count — total cumulative
  const { data: pwaCount } = useQuery({
    queryKey: ["admin-pwa-count-total"],
    queryFn: async () => {
      const { count } = await fromTable("pwa_installs").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  // PWA installs in current period
  const { data: pwaPeriodCount } = useQuery({
    queryKey: ["admin-pwa-count-period", period],
    queryFn: async () => {
      if (!since) {
        const { count } = await fromTable("pwa_installs").select("id", { count: "exact", head: true });
        return count || 0;
      }
      const { count } = await fromTable("pwa_installs").select("id", { count: "exact", head: true }).gte("created_at", since);
      return count || 0;
    },
  });

  return (
    <AdminLayout title="Analytics & Tracking">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={20} /> Vue d'ensemble
          </h2>
          <div className="flex gap-1 flex-wrap">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                  period === p.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">Chargement…</div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="overview" className="text-xs">
                <BarChart3 size={14} className="mr-1" /> Vue générale
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs">
                <Package size={14} className="mr-1" /> Produits
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <OverviewTab
                kpis={kpis || {}}
                dailyTraffic={dailyTraffic || []}
                topProducts={topProducts || []}
                topStores={topStores || []}
                topPages={topPages || []}
                devices={devices || {}}
                pwaCount={pwaCount || 0}
                pwaPeriodCount={pwaPeriodCount || 0}
              />
            </TabsContent>
            <TabsContent value="products">
              <ProductTrackingTab period={period} since={since} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}
