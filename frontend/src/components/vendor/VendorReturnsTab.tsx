import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RotateCcw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ReturnRequest {
  id: string;
  order_id: string;
  reason: string;
  description: string | null;
  status: string;
  refund_amount: number;
  created_at: string;
  order_ref?: string;
  customer_email?: string;
}

export function VendorReturnsTab({ storeId }: { storeId: string }) {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("return_requests")
      .select("id, order_id, reason, description, status, refund_amount, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const orderIds = [...new Set(data.map(r => r.order_id))];
      const userIds: string[] = [];
      const { data: orders } = await supabase.from("orders").select("id, order_ref, user_id").in("id", orderIds);
      const orderMap = new Map((orders || []).map(o => { userIds.push(o.user_id); return [o.id, o]; }));

      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, email").in("id", [...new Set(userIds)])
        : { data: [] };
      const emailMap = new Map((profiles || []).map(p => [p.id, p.email]));

      setReturns(data.map(r => {
        const order = orderMap.get(r.order_id);
        return {
          ...r,
          order_ref: order?.order_ref || r.order_id.slice(0, 8),
          customer_email: order ? emailMap.get(order.user_id) || "Client" : "Client",
        };
      }));
    } else {
      setReturns([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [storeId]);

  const statusBadge = (s: string) => {
    switch (s) {
      case "pending": return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1"><Clock size={10} />En attente</span>;
      case "approved": return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 size={10} />Approuvé</span>;
      case "rejected": return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-destructive/10 text-destructive flex items-center gap-1"><XCircle size={10} />Refusé</span>;
      default: return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground">{s}</span>;
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  if (returns.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <RotateCcw size={40} className="mx-auto text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">Aucune demande de retour.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
        <RotateCcw size={16} className="text-primary" /> Retours ({returns.length})
      </h3>
      {returns.map(r => (
        <div key={r.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">{r.order_ref}</p>
              <p className="text-[11px] text-muted-foreground">{r.customer_email} · {new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
            </div>
            {statusBadge(r.status)}
          </div>
          <p className="text-xs text-foreground"><strong>Motif :</strong> {r.reason}</p>
          {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
          <p className="text-xs text-primary font-medium">Remboursement : ${Number(r.refund_amount).toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}
