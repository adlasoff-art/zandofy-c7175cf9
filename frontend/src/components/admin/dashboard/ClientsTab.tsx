import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";
import { format, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users, UserCheck, TrendingUp, Gift } from "lucide-react";
import { TOOLTIP_STYLE, KpiCardRow } from "./shared";
import type { PeriodKey } from "./DashboardPeriodSelector";
import { getPeriodDate } from "./DashboardPeriodSelector";

interface Props { period: PeriodKey; }

export function ClientsTab({ period }: Props) {
  const sinceDate = getPeriodDate(period);
  const since = sinceDate.toISOString();

  // Profiles for registration curve
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-clients-profiles", period],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, created_at").gte("created_at", since);
      return data ?? [];
    },
  });

  // Orders for top clients
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-clients-orders", period],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("user_id, total, status").gte("created_at", since);
      return data ?? [];
    },
  });

  // Referrals for top referrers
  const { data: referrals = [] } = useQuery({
    queryKey: ["admin-clients-referrals", period],
    queryFn: async () => {
      const { data } = await fromTable("referrals").select("referrer_id, status, created_at").gte("created_at", since);
      return data ?? [];
    },
  });

  // All profiles for name lookup
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin-clients-all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email");
      return data ?? [];
    },
  });

  const profileMap = new Map(allProfiles.map(p => [p.id, p]));

  // New registrations curve
  const regCurve = (() => {
    const days = eachDayOfInterval({ start: sinceDate, end: new Date() });
    const map: Record<string, { date: string; count: number }> = {};
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = { date: format(d, days.length > 60 ? "d/MM" : "d MMM", { locale: fr }), count: 0 };
    });
    profiles.forEach((p) => {
      const key = format(new Date(p.created_at), "yyyy-MM-dd");
      if (map[key]) map[key].count++;
    });
    return Object.values(map);
  })();

  // Top 10 clients by spending
  const topClients = (() => {
    const agg: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.status !== "cancelled" && o.status !== "returned") {
        agg[o.user_id] = (agg[o.user_id] || 0) + Number(o.total);
      }
    });
    return Object.entries(agg)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id, spent]) => {
        const p = profileMap.get(id);
        return { name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Client" : "Client", spent: Math.round(spent) };
      });
  })();

  // Top 10 referrers
  const topReferrers = (() => {
    const agg: Record<string, number> = {};
    referrals.forEach((r: any) => {
      agg[r.referrer_id] = (agg[r.referrer_id] || 0) + 1;
    });
    return Object.entries(agg)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id, count]) => {
        const p = profileMap.get(id);
        return { name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Utilisateur" : "Utilisateur", count };
      });
  })();

  // KPIs
  const newClients = profiles.length;
  const buyers = new Set(orders.filter(o => o.status !== "cancelled" && o.status !== "returned").map(o => o.user_id)).size;
  const conversionRate = newClients > 0 ? Math.round((buyers / newClients) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardRow icon={Users} label="Nouveaux inscrits" value={newClients.toString()} />
        <KpiCardRow icon={UserCheck} label="Acheteurs" value={buyers.toString()} color="text-primary" />
        <KpiCardRow icon={TrendingUp} label="Taux conversion" value={`${conversionRate}%`} color="text-primary" />
        <KpiCardRow icon={Gift} label="Parrainages" value={referrals.length.toString()} color="text-amber-500" />
      </div>

      {/* Registration curve */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Nouveaux inscrits par jour</h2>
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
              <Area type="monotone" dataKey="count" name="Inscriptions" stroke="hsl(var(--primary))" fill="url(#gradReg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top clients & referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 clients par dépenses</h2>
          <div className="h-[300px]">
            {topClients.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toLocaleString()}`, "Dépenses"]} />
                  <Bar dataKey="spent" name="Dépenses ($)" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 parrains</h2>
          <div className="h-[300px]">
            {topReferrers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p> : (
              <ResponsiveContainer width="100%" height="100%">
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
