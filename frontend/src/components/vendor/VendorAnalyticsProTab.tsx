import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Download, FileText, Mail, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from "lucide-react";
import {
  useVendorAnalyticsKpis, useVendorAnalyticsTimeseries, useVendorAnalyticsFunnel,
  useVendorAnalyticsTopProducts, useVendorAnalyticsCohorts, fetchOrdersExport,
} from "@/hooks/use-vendor-analytics-pro";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const PRESETS = [
  { key: "7", label: "7 jours" },
  { key: "30", label: "30 jours" },
  { key: "90", label: "90 jours" },
] as const;

function fmtMoney(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
}

function delta(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSV(rows: any[], filename: string) {
  if (!rows.length) { toast.error("Aucune donnée à exporter"); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(html: string, filename: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Bloqueur de popup"); return; }
  w.document.write(`<!doctype html><html><head><title>${filename}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#222}h1{font-size:20px;margin:0 0 8px}h2{font-size:14px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}.kpi{display:inline-block;margin:0 16px 16px 0;padding:12px 16px;border:1px solid #eee;border-radius:8px}.kpi b{display:block;font-size:18px}@media print{body{padding:0}}</style>
    </head><body>${html}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

interface Props { storeId: string }

export function VendorAnalyticsProTab({ storeId }: Props) {
  const [preset, setPreset] = useState<string>("30");
  const [city, setCity] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const { start, end } = useMemo(() => {
    const e = new Date();
    const s = new Date(); s.setDate(s.getDate() - parseInt(preset, 10));
    return { start: s, end: e };
  }, [preset]);

  const filters = { storeId, start, end, city: city || null, paymentMethod: paymentMethod || null };

  const kpis = useVendorAnalyticsKpis(filters);
  const ts = useVendorAnalyticsTimeseries(filters);
  const funnel = useVendorAnalyticsFunnel({ storeId, start, end });
  const top = useVendorAnalyticsTopProducts({ storeId, start, end }, 15);
  const cohorts = useVendorAnalyticsCohorts(storeId, 6);

  const k = kpis.data?.current;
  const p = kpis.data?.previous;

  const exportCSV = async () => {
    setExporting(true);
    try {
      const rows = await fetchOrdersExport(filters);
      downloadCSV(rows, `commandes-${preset}j-${Date.now()}.csv`);
      toast.success(`${rows.length} commandes exportées`);
    } catch (e: any) { toast.error(e.message || "Erreur export"); }
    finally { setExporting(false); }
  };

  const exportPDF = () => {
    if (!k) return;
    const html = `
      <h1>Rapport Analytics — ${preset} derniers jours</h1>
      <p>${start.toLocaleDateString("fr-FR")} → ${end.toLocaleDateString("fr-FR")}</p>
      <h2>KPIs</h2>
      <div class="kpi"><b>${fmtMoney(k.revenue)}</b>Chiffre d'affaires</div>
      <div class="kpi"><b>${k.orders}</b>Commandes</div>
      <div class="kpi"><b>${fmtMoney(k.aov)}</b>Panier moyen</div>
      <div class="kpi"><b>${fmtMoney(k.gross_margin)}</b>Marge brute (${k.margin_pct}%)</div>
      <div class="kpi"><b>${k.unique_customers}</b>Clients uniques</div>
      <h2>Top produits</h2>
      <table><thead><tr><th>Produit</th><th>Unités</th><th>CA</th><th>Marge</th><th>Stock</th></tr></thead>
      <tbody>${(top.data || []).map(t => `<tr><td>${t.product_name}</td><td>${t.units_sold}</td><td>${fmtMoney(t.revenue)}</td><td>${fmtMoney(t.margin)}</td><td>${t.current_stock}</td></tr>`).join("")}</tbody></table>
      <h2>Cohortes clients</h2>
      <table><thead><tr><th>Mois</th><th>Clients</th><th>LTV</th><th>R-J30</th><th>R-J60</th><th>R-J90</th></tr></thead>
      <tbody>${(cohorts.data || []).map(c => `<tr><td>${c.cohort_month}</td><td>${c.customers}</td><td>${fmtMoney(c.ltv)}</td><td>${c.retention_d30_pct}%</td><td>${c.retention_d60_pct}%</td><td>${c.retention_d90_pct}%</td></tr>`).join("")}</tbody></table>
    `;
    downloadPDF(html, `rapport-analytics-${preset}j`);
  };

  const scheduleEmail = async () => {
    const email = prompt("Email pour réception des rapports automatiques :");
    if (!email) return;
    const freq = prompt("Fréquence ? (weekly / monthly)", "weekly");
    if (!freq || !["weekly", "monthly"].includes(freq)) return;
    const fmt = prompt("Format ? (csv / pdf)", "pdf");
    if (!fmt || !["csv", "pdf"].includes(fmt)) return;
    const { error } = await (supabase as any).from("vendor_analytics_email_schedules").insert({
      store_id: storeId, recipient_email: email, frequency: freq, format: fmt,
      day_of_week: freq === "weekly" ? 1 : null, day_of_month: freq === "monthly" ? 1 : null,
    });
    if (error) toast.error(error.message); else toast.success("Planification créée");
  };

  if (kpis.isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="flex gap-1">
            {PRESETS.map(pr => (
              <Button key={pr.key} size="sm" variant={preset === pr.key ? "default" : "outline"} onClick={() => setPreset(pr.key)}>{pr.label}</Button>
            ))}
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Ville client</label>
            <Input placeholder="Toutes" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs text-muted-foreground">Méthode paiement</label>
            <Select value={paymentMethod || "all"} onValueChange={v => setPaymentMethod(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="card">Carte</SelectItem>
                <SelectItem value="cod">COD</SelectItem>
                <SelectItem value="off_platform">Hors plateforme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="w-4 h-4" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={scheduleEmail}><Mail className="w-4 h-4" /> Programmer</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs avec comparaison */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { lbl: "CA", val: fmtMoney(k?.revenue || 0), d: delta(k?.revenue || 0, p?.revenue || 0) },
          { lbl: "Commandes", val: String(k?.orders || 0), d: delta(k?.orders || 0, p?.orders || 0) },
          { lbl: "Panier moyen", val: fmtMoney(k?.aov || 0), d: delta(k?.aov || 0, p?.aov || 0) },
          { lbl: `Marge (${k?.margin_pct || 0}%)`, val: fmtMoney(k?.gross_margin || 0), d: delta(k?.gross_margin || 0, p?.gross_margin || 0) },
          { lbl: "Clients uniques", val: String(k?.unique_customers || 0), d: delta(k?.unique_customers || 0, p?.unique_customers || 0) },
        ].map((it, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{it.lbl}</div>
              <div className="text-xl font-bold">{it.val}</div>
              <div className={`text-xs flex items-center gap-1 ${it.d >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {it.d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {it.d > 0 ? "+" : ""}{it.d}% vs période préc.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Time series */}
      <Card>
        <CardHeader><CardTitle className="text-base">Évolution journalière</CardTitle></CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={ts.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" name="CA" />
                <Line type="monotone" dataKey="margin" stroke="#10b981" name="Marge" />
                <Line type="monotone" dataKey="orders" stroke="#f59e0b" name="Commandes" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Funnel */}
      <Card>
        <CardHeader><CardTitle className="text-base">Funnel checkout</CardTitle></CardHeader>
        <CardContent>
          {funnel.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { lbl: "Vues produit", v: funnel.data.views, sub: "" },
                { lbl: "Ajouts panier", v: funnel.data.cart_additions, sub: `${funnel.data.view_to_cart_pct}% des vues` },
                { lbl: "Checkouts", v: funnel.data.checkouts, sub: `${funnel.data.cart_to_checkout_pct}% des paniers` },
                { lbl: "Payés", v: funnel.data.paid, sub: `${funnel.data.checkout_to_paid_pct}% des checkouts · CVR global ${funnel.data.overall_cvr_pct}%` },
              ].map((s, i) => (
                <div key={i} className="border border-border rounded p-3">
                  <div className="text-xs text-muted-foreground">{s.lbl}</div>
                  <div className="text-xl font-bold">{s.v}</div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top produits */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top produits</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr><th className="text-left py-2">Produit</th><th className="text-right">Unités</th><th className="text-right">CA</th><th className="text-right">Marge</th><th className="text-right">Stock</th></tr>
              </thead>
              <tbody>
                {(top.data || []).map(t => (
                  <tr key={t.product_id} className="border-b">
                    <td className="py-2 flex items-center gap-2">{t.product_name}{t.is_low_stock && <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="w-3 h-3" />stock bas</Badge>}</td>
                    <td className="text-right">{t.units_sold}</td>
                    <td className="text-right">{fmtMoney(t.revenue)}</td>
                    <td className="text-right">{fmtMoney(t.margin)}</td>
                    <td className="text-right">{t.current_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cohortes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cohortes clients (6 derniers mois)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr><th className="text-left py-2">Mois cohorte</th><th className="text-right">Nouveaux clients</th><th className="text-right">LTV</th><th className="text-right">Rétention J30</th><th className="text-right">J60</th><th className="text-right">J90</th></tr>
              </thead>
              <tbody>
                {(cohorts.data || []).map(c => (
                  <tr key={c.cohort_month} className="border-b">
                    <td className="py-2">{new Date(c.cohort_month).toLocaleDateString("fr-FR", { year: "numeric", month: "short" })}</td>
                    <td className="text-right">{c.customers}</td>
                    <td className="text-right">{fmtMoney(c.ltv)}</td>
                    <td className="text-right">{c.retention_d30_pct}%</td>
                    <td className="text-right">{c.retention_d60_pct}%</td>
                    <td className="text-right">{c.retention_d90_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}