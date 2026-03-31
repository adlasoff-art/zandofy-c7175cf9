import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StoreIcon, TrendingUp, ChevronDown, ChevronRight, Wallet, Star, Package } from "lucide-react";
import { TOOLTIP_STYLE, KpiCardRow } from "./shared";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";
import type { GlobalFilters } from "./DashboardGlobalFilters";

interface Props { period: PeriodKey; geoFilters?: GlobalFilters; }

export function VendorsTab({ period, geoFilters }: Props) {
  const sinceDate = getPeriodDate(period);
  const since = sinceDate?.toISOString() ?? new Date(0).toISOString();
  const country = geoFilters?.country !== "all" ? geoFilters?.country : undefined;
  const city = geoFilters?.city !== "all" ? geoFilters?.city : undefined;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: vendorData } = useQuery({
    queryKey: ["admin-vendors-tab", period, country, city],
    queryFn: async () => {
      let q = (supabase as any).from("orders").select("total, status, store_id, payment_method, shipping_country, shipping_city").gte("created_at", since).not("store_id", "is", null);
      if (country) q = q.eq("shipping_country", country);
      if (city) q = q.eq("shipping_city", city);
      const { data: orders } = await q;
      const { data: stores } = await supabase.from("stores").select("id, name, products_count, rating, created_at, logo_url");
      const { data: wallets } = await (supabase as any).from("vendor_wallets").select("store_id, available_balance, pending_balance, total_earned, total_withdrawn");

      if (!orders || !stores) return { topByRevenue: [], topByCount: [], entries: [], totalVendors: 0, newStores: 0 };

      const storeMap = new Map(stores.map((s: any) => [s.id, s]));
      const walletMap = new Map((wallets || []).map((w: any) => [w.store_id, w]));

      const agg: Record<string, { revenue: number; count: number; byMethod: Record<string, number> }> = {};
      orders.forEach((o: any) => {
        if (!o.store_id) return;
        if (!agg[o.store_id]) agg[o.store_id] = { revenue: 0, count: 0, byMethod: {} };
        agg[o.store_id].count++;
        const method = o.payment_method || "unknown";
        agg[o.store_id].byMethod[method] = (agg[o.store_id].byMethod[method] || 0) + Number(o.total);
        if (o.status !== "cancelled" && o.status !== "returned") agg[o.store_id].revenue += Number(o.total);
      });

      const entries = Object.entries(agg).map(([id, d]) => {
        const store = storeMap.get(id);
        const wallet = walletMap.get(id);
        return {
          id, name: store?.name || "Boutique inconnue",
          revenue: Math.round(d.revenue), count: d.count,
          products: store?.products_count ?? 0, rating: store?.rating ?? 0,
          logoUrl: store?.logo_url,
          byMethod: d.byMethod,
          walletAvailable: Number(wallet?.available_balance || 0),
          walletPending: Number(wallet?.pending_balance || 0),
          totalEarned: Number(wallet?.total_earned || 0),
          totalWithdrawn: Number(wallet?.total_withdrawn || 0),
        };
      }).sort((a, b) => b.revenue - a.revenue);

      const topByRevenue = entries.slice(0, 10);
      const topByCount = [...entries].sort((a, b) => b.count - a.count).slice(0, 10);
      const newStores = stores.filter((s: any) => sinceDate && new Date(s.created_at) >= sinceDate).length;

      return { topByRevenue, topByCount, entries, totalVendors: stores.length, newStores };
    },
  });

  const { topByRevenue = [], topByCount = [], entries = [], totalVendors = 0, newStores = 0 } = vendorData ?? {};

  const methodLabel = (m: string) => {
    const labels: Record<string, string> = { mobile_money: "Mobile Money", cod: "Contre remboursement", stripe: "Carte", off_platform: "Hors plateforme", paypal: "PayPal", unknown: "Non spécifié" };
    return labels[m] || m;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardRow icon={StoreIcon} label="Boutiques totales" value={totalVendors.toString()} />
        <KpiCardRow icon={TrendingUp} label="Nouvelles boutiques" value={newStores.toString()} color="text-primary" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 par chiffre d'affaires</h2>
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

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 par commandes</h2>
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
      </div>

      {/* Accordion Vendor List */}
      {entries.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Classement vendeurs</h2>
          <div className="space-y-1">
            {entries.slice(0, 30).map((v, i) => (
              <Collapsible key={v.id} open={expandedId === v.id} onOpenChange={(open) => setExpandedId(open ? v.id : null)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <span className="text-xs text-muted-foreground w-6 shrink-0 text-right">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {v.logoUrl ? (
                        <img src={v.logoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <StoreIcon size={14} className="text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1 text-left truncate">{v.name}</span>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm font-semibold text-foreground">${v.revenue.toLocaleString()}</span>
                      <Badge variant="secondary" className="text-[10px]">{v.count} cmd</Badge>
                      {v.rating > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600">
                          <Star size={10} className="fill-current" /> {v.rating}
                        </span>
                      )}
                      {expandedId === v.id ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-12 mr-3 mb-3 p-3 bg-muted/30 rounded-lg space-y-3">
                    {/* Wallet Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="text-center p-2 bg-background rounded-md">
                        <p className="text-[10px] text-muted-foreground">Wallet dispo</p>
                        <p className="text-sm font-semibold text-emerald-600">${v.walletAvailable.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-2 bg-background rounded-md">
                        <p className="text-[10px] text-muted-foreground">En attente</p>
                        <p className="text-sm font-semibold text-amber-600">${v.walletPending.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-2 bg-background rounded-md">
                        <p className="text-[10px] text-muted-foreground">Total gagné</p>
                        <p className="text-sm font-semibold text-foreground">${v.totalEarned.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-2 bg-background rounded-md">
                        <p className="text-[10px] text-muted-foreground">Retiré</p>
                        <p className="text-sm font-semibold text-foreground">${v.totalWithdrawn.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Revenue by payment method */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Répartition par méthode de paiement</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(v.byMethod).map(([method, amount]) => (
                          <div key={method} className="px-2 py-1 bg-background rounded text-xs">
                            <span className="text-muted-foreground">{methodLabel(method)}:</span>{" "}
                            <span className="font-semibold">${(amount as number).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Package size={12} /> {v.products} produits</span>
                      <span className="flex items-center gap-1"><Wallet size={12} /> {v.count} commandes</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
