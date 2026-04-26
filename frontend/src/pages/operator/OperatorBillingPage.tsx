/**
 * OperatorBillingPage — Lot 11B Phase B2 (Lecture seule du ledger commission)
 */
import { useQuery } from "@tanstack/react-query";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { fromTable } from "@/lib/supabase-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Banknote } from "lucide-react";

export default function OperatorBillingPage() {
  const { operator } = useOperatorContext();

  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ["operator-billing", operator?.id],
    enabled: !!operator?.id,
    queryFn: async () => {
      const { data } = await fromTable("operator_commission_ledger")
        .select("id, order_id, delivery_fee, platform_commission_pct, platform_commission_amount, operator_net_amount, currency, payout_status, paid_at, recorded_at")
        .eq("operator_id", operator!.id).order("recorded_at", { ascending: false }).limit(500);
      return (data ?? []) as any[];
    },
  });

  const totals = ledger.reduce((acc, l) => {
    acc.gross += Number(l.delivery_fee);
    acc.commission += Number(l.platform_commission_amount);
    acc.net += Number(l.operator_net_amount);
    if (l.payout_status === "pending") acc.pending += Number(l.operator_net_amount);
    if (l.payout_status === "paid") acc.paid += Number(l.operator_net_amount);
    return acc;
  }, { gross: 0, commission: 0, net: 0, pending: 0, paid: 0 });

  const exportCsv = () => {
    const header = "date,order_id,delivery_fee,commission_pct,commission_amount,net_amount,currency,payout_status\n";
    const rows = ledger.map((l) => `${l.recorded_at},${l.order_id},${l.delivery_fee},${l.platform_commission_pct},${l.platform_commission_amount},${l.operator_net_amount},${l.currency},${l.payout_status}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `commissions_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!operator) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div><h1 className="text-2xl font-bold">Facturation</h1><p className="text-sm text-muted-foreground">Commissions et paiements.</p></div>
        <Button variant="outline" onClick={exportCsv} disabled={ledger.length === 0}><Download size={14} /> Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total brut" value={`$${totals.gross.toFixed(2)}`} />
        <SummaryCard label="Commission Zandofy" value={`$${totals.commission.toFixed(2)}`} />
        <SummaryCard label="Net opérateur" value={`$${totals.net.toFixed(2)}`} accent />
        <SummaryCard label="En attente paiement" value={`$${totals.pending.toFixed(2)}`} hint={`Payé : $${totals.paid.toFixed(2)}`} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Historique des commissions</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <Loader2 className="animate-spin mx-auto my-4" size={20} />}
          {!isLoading && ledger.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune transaction</p>}
          <div className="divide-y divide-border">
            {ledger.map((l) => (
              <div key={l.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{l.order_id.slice(0, 8)}</p>
                  <p className="text-xs">{new Date(l.recorded_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${Number(l.operator_net_amount).toFixed(2)} <span className="text-xs text-muted-foreground">net</span></p>
                  <p className="text-[10px] text-muted-foreground">${Number(l.delivery_fee).toFixed(2)} − ${Number(l.platform_commission_amount).toFixed(2)} ({l.platform_commission_pct}%)</p>
                </div>
                <PayoutBadge status={l.payout_status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card><CardContent className="pt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${accent ? "text-[hsl(var(--operator-primary))]" : ""}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </CardContent></Card>
  );
}

function PayoutBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    disputed: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-muted"}`}>{status}</span>;
}