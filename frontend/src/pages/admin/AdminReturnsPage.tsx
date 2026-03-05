import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, RotateCcw, Search, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STATUS_TABS = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Approuvées" },
  { key: "rejected", label: "Refusées" },
  { key: "refunded", label: "Remboursées" },
];

export default function AdminReturnsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["admin-returns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("return_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = returns.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !r.reason.toLowerCase().includes(search.toLowerCase()) && !r.id.includes(search)) return false;
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    setProcessing(id);
    const { error } = await supabase
      .from("return_requests")
      .update({ status, admin_notes: adminNotes || null, resolved_at: new Date().toISOString() })
      .eq("id", id);

    if (error) toast.error("Erreur");
    else {
      toast.success(`Retour ${status === "approved" ? "approuvé" : status === "rejected" ? "refusé" : "remboursé"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      setExpandedId(null);
      setAdminNotes("");
    }
    setProcessing(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700",
      approved: "bg-emerald-100 text-emerald-700",
      rejected: "bg-destructive/10 text-destructive",
      refunded: "bg-blue-100 text-blue-700",
    };
    const labels: Record<string, string> = { pending: "En attente", approved: "Approuvé", rejected: "Refusé", refunded: "Remboursé" };
    return <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${map[status] || ""}`}>{labels[status] || status}</span>;
  };

  return (
    <AdminLayout title="Retours & Remboursements">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap ${
              statusFilter === t.key ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">Aucune demande de retour.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(r => (
              <div key={r.id}>
                <button
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/20 transition-colors text-sm"
                >
                  <RotateCcw size={14} className="text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{r.reason}</span>
                  <span className="font-semibold">${Number(r.refund_amount).toFixed(2)}</span>
                  {statusBadge(r.status)}
                  <span className="text-[10px] text-muted-foreground w-16 text-right">
                    {format(new Date(r.created_at), "d MMM", { locale: fr })}
                  </span>
                </button>

                {expandedId === r.id && (
                  <div className="px-4 pb-4 space-y-3 bg-muted/10">
                    <p className="text-xs text-muted-foreground">{r.description || "Pas de description"}</p>
                    <div className="text-xs space-y-1">
                      <p><strong>ID Commande :</strong> {r.order_id}</p>
                      <p><strong>Montant :</strong> ${Number(r.refund_amount).toFixed(2)}</p>
                    </div>

                    {r.status === "pending" && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Notes admin (optionnel)..."
                          value={adminNotes}
                          onChange={e => setAdminNotes(e.target.value)}
                          className="text-xs min-h-[50px]"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateStatus(r.id, "approved")} disabled={processing === r.id}>
                            <CheckCircle2 size={12} className="mr-1" /> Approuver
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStatus(r.id, "rejected")} disabled={processing === r.id}>
                            <XCircle size={12} className="mr-1" /> Refuser
                          </Button>
                        </div>
                      </div>
                    )}

                    {r.status === "approved" && (
                      <Button size="sm" onClick={() => updateStatus(r.id, "refunded")} disabled={processing === r.id}>
                        <DollarSign size={12} className="mr-1" /> Marquer remboursé
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
