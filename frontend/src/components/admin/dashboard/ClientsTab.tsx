import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users, UserCheck, TrendingUp, Gift } from "lucide-react";
import { TOOLTIP_STYLE, KpiCardRow } from "./shared";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";
import type { GlobalFilters } from "./DashboardGlobalFilters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props { period: PeriodKey; geoFilters?: GlobalFilters; }

export function ClientsTab({ period, geoFilters }: Props) {
  const [referrerLimit, setReferrerLimit] = useState("10");
  const [clientPage, setClientPage] = useState(1);
  const clientPageSize = 10;
  const sinceDate = getPeriodDate(period) ?? new Date(new Date().getFullYear() - 5, 0, 1);
  const since = sinceDate.toISOString();
  const country = geoFilters?.country !== "all" ? geoFilters?.country : undefined;
  const city = geoFilters?.city !== "all" ? geoFilters?.city : undefined;

  const { data: analytics } = useQuery({
    queryKey: ["admin-client-analytics", period, country, city],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_client_analytics", {
        _since: since,
        _country: country ?? null,
        _city: city ?? null,
      });
      if (!error && data) return data as any;

      // Fallback until RPC migration is applied — keep geo filters on spend
      let ordersQ = supabase
        .from("orders")
        .select("user_id, subtotal, total, created_at, status, shipping_country, shipping_city")
        .gte("created_at", since);
      if (country) ordersQ = ordersQ.eq("shipping_country", country) as typeof ordersQ;
      if (city) ordersQ = ordersQ.eq("shipping_city", city) as typeof ordersQ;

      const [{ data: profiles }, { data: orders }, { data: referrals }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, email, created_at").gte("created_at", since),
        ordersQ,
        (supabase as any).from("referrals").select("referrer_id, created_at").gte("created_at", since),
      ]);
      const dailySignups: Record<string, number> = {};
      (profiles || []).forEach((p: any) => {
        const day = p.created_at?.slice(0, 10);
        if (day) dailySignups[day] = (dailySignups[day] || 0) + 1;
      });
      const dailyReferrals: Record<string, number> = {};
      const referrerCounts: Record<string, number> = {};
      (referrals || []).forEach((r: any) => {
        const day = r.created_at?.slice(0, 10);
        if (day) dailyReferrals[day] = (dailyReferrals[day] || 0) + 1;
        if (r.referrer_id) referrerCounts[r.referrer_id] = (referrerCounts[r.referrer_id] || 0) + 1;
      });
      const spendByUser: Record<string, number> = {};
      const buyerIds = new Set<string>();
      (orders || []).forEach((o: any) => {
        if (!o.user_id) return;
        buyerIds.add(o.user_id);
        spendByUser[o.user_id] = (spendByUser[o.user_id] || 0) + Number(o.total ?? o.subtotal || 0);
      });
      const nameById: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        nameById[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || p.id.slice(0, 8);
      });
      // Enrich names for spenders not in period signups
      const missingIds = Object.keys(spendByUser).filter((id) => !nameById[id]);
      if (missingIds.length) {
        const { data: extra } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", missingIds.slice(0, 200));
        (extra || []).forEach((p: any) => {
          nameById[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || p.id.slice(0, 8);
        });
      }
      const clients = Object.entries(spendByUser)
        .map(([id, spent]) => ({ name: nameById[id] || id.slice(0, 8), spent }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 200);
      const referrers = Object.entries(referrerCounts)
        .map(([id, count]) => ({ name: nameById[id] || id.slice(0, 8), count }))
        .sort((a, b) => b.count - a.count);
      return {
        newClients: (profiles || []).length,
        buyers: buyerIds.size,
        referralCount: (referrals || []).length,
        dailySignups: Object.entries(dailySignups).map(([day, count]) => ({ day, count })),
        dailyReferrals: Object.entries(dailyReferrals).map(([day, count]) => ({ day, count })),
        clients,
        referrers,
      };
    },
  });

  const regCurve = (() => {
    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    const map: Record<string, { date: string; signups: number; referrals: number }> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }), signups: 0, referrals: 0 };
    });
    (analytics?.dailySignups ?? []).forEach((row: any) => {
      if (map[row.day]) map[row.day].signups = Number(row.count);
    });
    (analytics?.dailyReferrals ?? []).forEach((row: any) => {
      if (map[row.day]) map[row.day].referrals = Number(row.count);
    });
    return Object.values(map);
  })();

  const topClients = (analytics?.clients ?? []).map((client: any) => ({
    name: client.name,
    spent: Number(client.spent),
  }));
  const clientPageCount = Math.max(1, Math.ceil(topClients.length / clientPageSize));
  const currentClientPage = Math.min(clientPage, clientPageCount);
  const paginatedClients = topClients.slice((currentClientPage - 1) * clientPageSize, currentClientPage * clientPageSize);

  const topReferrers = (analytics?.referrers ?? []).slice(0, Number(referrerLimit)).map((referrer: any) => ({
    name: referrer.name,
    count: Number(referrer.count),
  }));

  const newClients = Number(analytics?.newClients ?? 0);
  const buyers = Number(analytics?.buyers ?? 0);
  const conversionRate = newClients > 0 ? Math.round((buyers / newClients) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardRow icon={Users} label="Nouveaux inscrits" value={newClients.toString()} />
        <KpiCardRow icon={UserCheck} label="Acheteurs" value={buyers.toString()} color="text-primary" />
        <KpiCardRow icon={TrendingUp} label="Taux conversion" value={`${conversionRate}%`} color="text-primary" />
        <KpiCardRow icon={Gift} label="Parrainages" value={Number(analytics?.referralCount ?? 0).toString()} color="text-amber-500" />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Inscriptions et parrainages par jour</h2>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={regCurve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval={Math.max(0, Math.floor(regCurve.length / 15))} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="signups" name="Inscriptions" stroke="hsl(var(--primary))" fill="url(#gradReg)" strokeWidth={2} />
              <Area type="monotone" dataKey="referrals" name="Parrainages" stroke="hsl(40, 80%, 50%)" fill="hsl(40, 80%, 50%)" fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Clients par dépenses</h2>
          <div className="h-[300px]">
            {topClients.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paginatedClients} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, "Dépenses"]} />
                  <Bar dataKey="spent" name="Dépenses ($)" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {topClients.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
              <span>Page {currentClientPage}/{clientPageCount}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentClientPage === 1} onClick={() => setClientPage(currentClientPage - 1)}>Précédent</Button>
                <Button size="sm" variant="outline" disabled={currentClientPage === clientPageCount} onClick={() => setClientPage(currentClientPage + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-foreground">Top parrains</h2>
            <Select value={referrerLimit} onValueChange={setReferrerLimit}>
              <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 200].map((size) => <SelectItem key={size} value={String(size)}>Top {size}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {topReferrers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <ResponsiveContainer width="100%" height={Math.max(300, topReferrers.length * 24)}>
                <BarChart data={topReferrers} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Filleuls" fill="hsl(40, 80%, 50%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
