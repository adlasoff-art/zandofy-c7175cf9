import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const FUNNEL_TYPES = [
  "discovery_onboarding_shown",
  "discovery_onboarding_step_complete",
  "discovery_onboarding_completed",
  "discovery_onboarding_dismissed",
  "discovery_feed_assembled",
] as const;

type Props = { since: string | null };

export function DiscoveryAnalyticsSection({ since }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-discovery-funnel", since],
    queryFn: async () => {
      let q = fromTable("analytics_events")
        .select("event_type, metadata, created_at")
        .in("event_type", [...FUNNEL_TYPES])
        .order("created_at", { ascending: false })
        .limit(2000);
      if (since) q = q.gte("created_at", since);
      const { data: rows, error } = await q;
      if (error) {
        console.warn("[DiscoveryAnalytics]", error.message);
        return { counts: {} as Record<string, number>, audiences: [] as { name: string; count: number }[], scopes: [] as { name: string; count: number }[] };
      }
      const counts: Record<string, number> = {};
      const audienceMap = new Map<string, number>();
      const scopeMap = new Map<string, number>();
      for (const r of rows || []) {
        const t = (r as any).event_type as string;
        counts[t] = (counts[t] || 0) + 1;
        if (t === "discovery_onboarding_completed") {
          const meta = ((r as any).metadata || {}) as Record<string, unknown>;
          const aud = String(meta.audience || "—");
          const scope = String(meta.purchase_scope || "—");
          audienceMap.set(aud, (audienceMap.get(aud) || 0) + 1);
          scopeMap.set(scope, (scopeMap.get(scope) || 0) + 1);
        }
      }
      return {
        counts,
        audiences: [...audienceMap.entries()].map(([name, count]) => ({ name, count })),
        scopes: [...scopeMap.entries()].map(([name, count]) => ({ name, count })),
      };
    },
  });

  const funnel = [
    { step: "Shown", count: data?.counts.discovery_onboarding_shown || 0 },
    { step: "Steps", count: data?.counts.discovery_onboarding_step_complete || 0 },
    { step: "Completed", count: data?.counts.discovery_onboarding_completed || 0 },
    { step: "Dismissed", count: data?.counts.discovery_onboarding_dismissed || 0 },
    { step: "Feed assembled", count: data?.counts.discovery_feed_assembled || 0 },
  ];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8">Chargement discovery…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {funnel.map((f) => (
          <div key={f.step} className="rounded-lg border border-border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{f.step}</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{f.count}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Funnel onboarding</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="step" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">Audience (completed)</h3>
          <ul className="space-y-1 text-sm">
            {(data?.audiences || []).map((a) => (
              <li key={a.name} className="flex justify-between">
                <span className="text-muted-foreground">{a.name}</span>
                <span className="font-medium tabular-nums">{a.count}</span>
              </li>
            ))}
            {!data?.audiences?.length && (
              <li className="text-muted-foreground text-xs">Pas encore de completions</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">Purchase scope (completed)</h3>
          <ul className="space-y-1 text-sm">
            {(data?.scopes || []).map((a) => (
              <li key={a.name} className="flex justify-between">
                <span className="text-muted-foreground">{a.name}</span>
                <span className="font-medium tabular-nums">{a.count}</span>
              </li>
            ))}
            {!data?.scopes?.length && (
              <li className="text-muted-foreground text-xs">Pas encore de completions</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
