import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, MousePointerClick, UserPlus, ShoppingCart, Mail, Bell, MessageSquare, X } from "lucide-react";

interface KPIs {
  delivered_popup: number;
  delivered_email: number;
  delivered_push: number;
  failed_email: number;
  clicked_popup: number;
  clicked_email: number;
  dismissed_popup: number;
  converted_signup: number;
  converted_order: number;
  total_delivered: number;
  total_clicked: number;
  total_converted: number;
}

interface WorkflowPerf {
  workflow_id: string;
  workflow_name: string;
  delivered: number;
  clicked: number;
  converted: number;
}

interface JourneyRow {
  workflow_id: string;
  workflow_name: string;
  user_id: string | null;
  anon_id: string | null;
  user_email: string | null;
  user_full_name: string | null;
  delivered_at: string;
  clicked: boolean;
  converted_signup: boolean;
  converted_order: boolean;
}

function getUserIdentity(j: JourneyRow): { primary: string; secondary?: string } {
  const shortId = (id: string) => id.replace(/-/g, "").slice(-4).toUpperCase();
  if (j.user_full_name && j.user_full_name.trim()) return { primary: j.user_full_name.trim() };
  if (j.user_email) return { primary: j.user_email };
  if (j.user_id) return { primary: `Client #${shortId(j.user_id)}`, secondary: "compte sans nom" };
  if (j.anon_id) return { primary: `Visiteur #${shortId(j.anon_id)}`, secondary: "non inscrit" };
  return { primary: "—" };
}

const PERIOD_OPTIONS = [
  { key: "7d", label: "7 jours", days: 7 },
  { key: "30d", label: "30 jours", days: 30 },
  { key: "90d", label: "90 jours", days: 90 },
  { key: "all", label: "Tout", days: null as number | null },
];

const PAGE_SIZE = 50;

export function AdminAutomationAnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [workflowPerf, setWorkflowPerf] = useState<WorkflowPerf[]>([]);
  const [journey, setJourney] = useState<JourneyRow[]>([]);
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);
  const [period, setPeriod] = useState("30d");
  const [workflowFilter, setWorkflowFilter] = useState<string>("");
  const [page, setPage] = useState(0);

  const sinceISO = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((p) => p.key === period);
    if (!opt?.days) return null;
    const d = new Date();
    d.setDate(d.getDate() - opt.days);
    return d.toISOString();
  }, [period]);

  useEffect(() => {
    (supabase as any)
      .from("automation_workflows")
      .select("id, name")
      .order("sort_order")
      .then(({ data }: any) => setWorkflows(data || []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const wfId = workflowFilter || null;
      const [kpiRes, perfRes, journeyRes] = await Promise.all([
        (supabase as any).rpc("get_automation_kpis", { p_workflow_id: wfId, p_since: sinceISO }),
        (supabase as any).rpc("get_automation_workflow_performance", { p_since: sinceISO }),
        (supabase as any).rpc("get_automation_user_journey", {
          p_workflow_id: wfId,
          p_since: sinceISO,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
        }),
      ]);

      if (cancelled) return;
      setKpis(kpiRes.data || null);
      setWorkflowPerf(perfRes.data || []);
      setJourney(journeyRes.data || []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [sinceISO, workflowFilter, page]);

  const ctr = kpis && kpis.total_delivered > 0
    ? ((kpis.total_clicked / kpis.total_delivered) * 100).toFixed(1)
    : "0.0";
  const convRate = kpis && kpis.total_delivered > 0
    ? ((kpis.total_converted / kpis.total_delivered) * 100).toFixed(1)
    : "0.0";

  const inputClass = "px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={workflowFilter} onChange={(e) => { setWorkflowFilter(e.target.value); setPage(0); }} className={inputClass}>
          <option value="">Tous les workflows</option>
          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(0); }} className={inputClass}>
          {PERIOD_OPTIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<TrendingUp size={14} />} label="Délivrés (total)" value={kpis?.total_delivered ?? 0} />
            <KPICard icon={<MousePointerClick size={14} />} label="Taux de clic" value={`${ctr}%`} sub={`${kpis?.total_clicked ?? 0} clics`} />
            <KPICard icon={<UserPlus size={14} />} label="Comptes créés" value={kpis?.converted_signup ?? 0} />
            <KPICard icon={<ShoppingCart size={14} />} label="Commandes" value={kpis?.converted_order ?? 0} />
            <KPICard icon={<Bell size={14} />} label="Popups affichés" value={kpis?.delivered_popup ?? 0} sub={`${kpis?.dismissed_popup ?? 0} fermés`} />
            <KPICard icon={<Mail size={14} />} label="Emails envoyés" value={kpis?.delivered_email ?? 0} sub={`${kpis?.failed_email ?? 0} échecs`} />
            <KPICard icon={<MessageSquare size={14} />} label="Push envoyés" value={kpis?.delivered_push ?? 0} />
            <KPICard icon={<TrendingUp size={14} />} label="Taux conversion" value={`${convRate}%`} sub={`${kpis?.total_converted ?? 0} conversions`} />
          </div>

          {/* Performance par workflow */}
          <section className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Performance par workflow</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Workflow</th>
                    <th className="py-2 pr-3 text-right">Délivrés</th>
                    <th className="py-2 pr-3 text-right">Clics</th>
                    <th className="py-2 pr-3 text-right">CTR</th>
                    <th className="py-2 pr-3 text-right">Conv.</th>
                    <th className="py-2 pr-3 text-right">Tx conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowPerf.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Aucune donnée pour cette période.</td></tr>
                  ) : workflowPerf.map((w) => {
                    const wfCtr = w.delivered > 0 ? ((Number(w.clicked) / Number(w.delivered)) * 100).toFixed(1) : "0";
                    const wfConv = w.delivered > 0 ? ((Number(w.converted) / Number(w.delivered)) * 100).toFixed(1) : "0";
                    return (
                      <tr key={w.workflow_id} className="border-b border-border/50">
                        <td className="py-2 pr-3 text-foreground truncate max-w-[200px]">{w.workflow_name}</td>
                        <td className="py-2 pr-3 text-right text-foreground">{Number(w.delivered)}</td>
                        <td className="py-2 pr-3 text-right text-foreground">{Number(w.clicked)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{wfCtr}%</td>
                        <td className="py-2 pr-3 text-right text-foreground">{Number(w.converted)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{wfConv}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Parcours utilisateur */}
          <section className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Parcours utilisateur</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-2 py-1 rounded border border-border disabled:opacity-40">‹</button>
                <span>Page {page + 1}</span>
                <button disabled={journey.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded border border-border disabled:opacity-40">›</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Utilisateur</th>
                    <th className="py-2 pr-3">Workflow</th>
                    <th className="py-2 pr-3">Reçu le</th>
                    <th className="py-2 pr-3">Clic</th>
                    <th className="py-2 pr-3">Compte</th>
                    <th className="py-2 pr-3">Commande</th>
                  </tr>
                </thead>
                <tbody>
                  {journey.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Aucun parcours pour cette période.</td></tr>
                  ) : journey.map((j, i) => {
                    const identity = getUserIdentity(j);
                    return (
                    <tr key={`${j.workflow_id}-${j.user_id || j.anon_id}-${i}`} className="border-b border-border/50">
                      <td className="py-2 pr-3 max-w-[200px]">
                        <div className="text-foreground truncate">{identity.primary}</div>
                        {identity.secondary && (
                          <div className="text-[10px] text-muted-foreground truncate">{identity.secondary}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground truncate max-w-[180px]">{j.workflow_name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(j.delivered_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="py-2 pr-3">{j.clicked ? "✅" : <X size={12} className="text-muted-foreground" />}</td>
                      <td className="py-2 pr-3">{j.converted_signup ? "✅" : <X size={12} className="text-muted-foreground" />}</td>
                      <td className="py-2 pr-3">{j.converted_order ? "✅" : <X size={12} className="text-muted-foreground" />}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">Attribution : compte créé sous 7j / commande passée sous 14j après réception.</p>
          </section>
        </>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {icon} {label}
      </div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
