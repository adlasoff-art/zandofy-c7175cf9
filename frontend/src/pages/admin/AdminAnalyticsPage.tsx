import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Header } from "@/components/Header";
import {
  BarChart3, Users, Eye, MousePointer, Smartphone, Monitor, Tablet,
  Globe, TrendingUp, Clock, Download, Store,
} from "lucide-react";

const PERIODS = [
  { key: "7d", label: "7 jours", days: 7 },
  { key: "30d", label: "30 jours", days: 30 },
  { key: "90d", label: "3 mois", days: 90 },
  { key: "365d", label: "1 an", days: 365 },
];

interface AnalyticsEvent {
  event_type: string;
  page_path: string | null;
  product_id: string | null;
  store_id: string | null;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  is_pwa: boolean | null;
  session_id: string;
  user_id: string | null;
  duration_seconds: number | null;
  created_at: string;
  metadata: any;
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const days = PERIODS.find((p) => p.key === period)?.days || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-analytics", period],
    queryFn: async () => {
      const { data } = await (supabase.from("analytics_events") as any)
        .select("event_type, page_path, product_id, store_id, device_type, os, browser, is_pwa, session_id, user_id, duration_seconds, created_at, metadata")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50000);
      return (data || []) as AnalyticsEvent[];
    },
  });

  const allEvents = events || [];
  const pageViews = allEvents.filter((e) => e.event_type === "page_view");
  const productClicks = allEvents.filter((e) => e.event_type === "product_click");
  const storeViews = allEvents.filter((e) => e.event_type === "store_view");
  const pwaInstalls = allEvents.filter((e) => e.event_type === "pwa_install");
  const sessionEnds = allEvents.filter((e) => e.event_type === "session_end");

  const uniqueSessions = new Set(allEvents.map((e) => e.session_id)).size;
  const uniqueUsers = new Set(allEvents.filter((e) => e.user_id).map((e) => e.user_id)).size;
  const anonymousVisitors = new Set(
    allEvents.filter((e) => !e.user_id).map((e) => e.session_id)
  ).size;

  const avgSessionDuration = sessionEnds.length > 0
    ? Math.round(sessionEnds.reduce((s, e) => s + (e.duration_seconds || 0), 0) / sessionEnds.length)
    : 0;

  // Device breakdown
  const deviceCounts = { mobile: 0, tablet: 0, desktop: 0 };
  const uniqueDeviceSessions = new Map<string, string>();
  allEvents.forEach((e) => {
    if (!uniqueDeviceSessions.has(e.session_id)) {
      uniqueDeviceSessions.set(e.session_id, e.device_type || "desktop");
    }
  });
  uniqueDeviceSessions.forEach((dt) => {
    if (dt in deviceCounts) deviceCounts[dt as keyof typeof deviceCounts]++;
  });

  // OS breakdown
  const osSessionMap = new Map<string, string>();
  allEvents.forEach((e) => {
    if (!osSessionMap.has(e.session_id) && e.os) osSessionMap.set(e.session_id, e.os);
  });
  const osBreakdown: Record<string, number> = {};
  osSessionMap.forEach((os) => { osBreakdown[os] = (osBreakdown[os] || 0) + 1; });

  // PWA vs Web
  const pwaSessions = new Set(allEvents.filter((e) => e.is_pwa).map((e) => e.session_id)).size;
  const webSessions = uniqueSessions - pwaSessions;

  // Top pages
  const pageCounts: Record<string, number> = {};
  pageViews.forEach((e) => { const p = e.page_path || "/"; pageCounts[p] = (pageCounts[p] || 0) + 1; });
  const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Top products
  const productClickCounts: Record<string, number> = {};
  productClicks.forEach((e) => { if (e.product_id) productClickCounts[e.product_id] = (productClickCounts[e.product_id] || 0) + 1; });
  const topProducts = Object.entries(productClickCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Top stores
  const storeViewCounts: Record<string, number> = {};
  storeViews.forEach((e) => { if (e.store_id) storeViewCounts[e.store_id] = (storeViewCounts[e.store_id] || 0) + 1; });
  const topStores = Object.entries(storeViewCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // PWA installs by OS
  const pwaByOS: Record<string, number> = {};
  pwaInstalls.forEach((e) => {
    const os = (e.metadata as any)?.os || e.os || "unknown";
    pwaByOS[os] = (pwaByOS[os] || 0) + 1;
  });

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const StatCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) => (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon size={16} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 size={22} /> Analytics & Tracking
              </h1>
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      period === p.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">Chargement...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard icon={Eye} label="Pages vues" value={pageViews.length} />
                  <StatCard icon={Users} label="Sessions" value={uniqueSessions} />
                  <StatCard icon={Users} label="Connectés" value={uniqueUsers} />
                  <StatCard icon={Globe} label="Anonymes" value={anonymousVisitors} />
                  <StatCard icon={Clock} label="Durée moy." value={formatDuration(avgSessionDuration)} />
                  <StatCard icon={Download} label="PWA installées" value={pwaInstalls.length} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Monitor size={16} /> Appareils
                    </h3>
                    <div className="space-y-2">
                      {([
                        { label: "Mobile", icon: Smartphone, count: deviceCounts.mobile },
                        { label: "Tablette", icon: Tablet, count: deviceCounts.tablet },
                        { label: "Ordinateur", icon: Monitor, count: deviceCounts.desktop },
                      ] as const).map((d) => {
                        const pct = uniqueSessions > 0 ? Math.round((d.count / uniqueSessions) * 100) : 0;
                        return (
                          <div key={d.label} className="flex items-center gap-2">
                            <d.icon size={14} className="text-muted-foreground" />
                            <span className="text-sm text-foreground flex-1">{d.label}</span>
                            <span className="text-sm font-medium text-foreground">{d.count}</span>
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Globe size={16} /> Systèmes d'exploitation
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(osBreakdown).sort((a, b) => b[1] - a[1]).map(([os, count]) => {
                        const pct = uniqueSessions > 0 ? Math.round((count / uniqueSessions) * 100) : 0;
                        return (
                          <div key={os} className="flex items-center gap-2">
                            <span className="text-sm text-foreground flex-1 capitalize">{os}</span>
                            <span className="text-sm font-medium text-foreground">{count}</span>
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Smartphone size={16} /> PWA vs Navigateur
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground flex-1">PWA installée</span>
                        <span className="text-sm font-medium text-foreground">{pwaSessions}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground flex-1">Navigateur web</span>
                        <span className="text-sm font-medium text-foreground">{webSessions}</span>
                      </div>
                      {Object.entries(pwaByOS).length > 0 && (
                        <>
                          <hr className="border-border" />
                          <p className="text-xs text-muted-foreground font-medium">Installations par OS</p>
                          {Object.entries(pwaByOS).sort((a, b) => b[1] - a[1]).map(([os, count]) => (
                            <div key={os} className="flex items-center gap-2">
                              <span className="text-xs text-foreground flex-1 capitalize">{os}</span>
                              <span className="text-xs font-medium text-foreground">{count}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp size={16} /> Pages les plus visitées
                    </h3>
                    <div className="space-y-1.5">
                      {topPages.map(([path, count], i) => (
                        <div key={path} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                          <span className="text-xs text-foreground flex-1 truncate">{path}</span>
                          <span className="text-xs font-medium text-foreground">{count}</span>
                        </div>
                      ))}
                      {topPages.length === 0 && <p className="text-xs text-muted-foreground">Aucune donnée</p>}
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <MousePointer size={16} /> Produits les plus cliqués
                    </h3>
                    <div className="space-y-1.5">
                      {topProducts.map(([id, count], i) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                          <span className="text-xs text-foreground flex-1 truncate font-mono">{id.slice(0, 8)}...</span>
                          <span className="text-xs font-medium text-foreground">{count} clics</span>
                        </div>
                      ))}
                      {topProducts.length === 0 && <p className="text-xs text-muted-foreground">Aucune donnée</p>}
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Store size={16} /> Boutiques les plus visitées
                    </h3>
                    <div className="space-y-1.5">
                      {topStores.map(([id, count], i) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                          <span className="text-xs text-foreground flex-1 truncate font-mono">{id.slice(0, 8)}...</span>
                          <span className="text-xs font-medium text-foreground">{count} vues</span>
                        </div>
                      ))}
                      {topStores.length === 0 && <p className="text-xs text-muted-foreground">Aucune donnée</p>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
