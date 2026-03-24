import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Search, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DisputeChat } from "@/components/disputes/DisputeChat";

const STATUS_TABS = [
  { key: "all", label: "Tous" },
  { key: "open", label: "Ouverts" },
  { key: "under_review", label: "En examen" },
  { key: "resolved", label: "Résolus" },
  { key: "closed", label: "Fermés" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Basse" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
];

export default function AdminDisputesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = disputes.filter(d => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (search && !d.reason.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const updateDispute = async (id: string, status: string, extraFields: Record<string, any> = {}) => {
    setProcessing(id);
    const updates: Record<string, any> = { status, ...extraFields };
    if (status === "resolved" || status === "closed") {
      updates.resolved_at = new Date().toISOString();
      if (resolution) updates.resolution = resolution;
    }

    const { error } = await supabase.from("disputes").update(updates).eq("id", id);
    if (error) toast.error("Erreur");
    else {
      toast.success(`Litige mis à jour`);
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      setExpandedId(null);
      setResolution("");
    }
    setProcessing(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: "bg-amber-100 text-amber-700",
      under_review: "bg-blue-100 text-blue-700",
      resolved: "bg-emerald-100 text-emerald-700",
      closed: "bg-muted text-muted-foreground",
    };
    const labels: Record<string, string> = { open: "Ouvert", under_review: "En examen", resolved: "Résolu", closed: "Fermé" };
    return <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${map[status] || ""}`}>{labels[status] || status}</span>;
  };

  const priorityBadge = (p: string) => {
    const colors: Record<string, string> = {
      low: "text-muted-foreground", normal: "text-blue-600", high: "text-amber-600", urgent: "text-destructive",
    };
    return <span className={`text-[10px] font-medium ${colors[p] || ""}`}>{p.toUpperCase()}</span>;
  };

  return (
    <AdminLayout title="Litiges & Arbitrages">
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
          <p className="text-center py-8 text-sm text-muted-foreground">Aucun litige.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(d => (
              <div key={d.id}>
                <button
                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/20 transition-colors text-sm"
                >
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{d.reason}</span>
                  {priorityBadge(d.priority)}
                  {statusBadge(d.status)}
                  <span className="text-[10px] text-muted-foreground w-16 text-right">
                    {format(new Date(d.created_at), "d MMM", { locale: fr })}
                  </span>
                </button>

                {expandedId === d.id && (
                  <div className="px-4 pb-4 space-y-3 bg-muted/10">
                    <p className="text-xs text-muted-foreground">{d.description || "Pas de description"}</p>
                    <div className="text-xs space-y-1">
                      <p><strong>Commande :</strong> {d.order_id}</p>
                      {d.return_request_id && <p><strong>Retour lié :</strong> {d.return_request_id}</p>}
                    </div>

                    {/* Dispute Chat */}
                    <div className="border border-border rounded-lg p-3 bg-background">
                      <DisputeChat disputeId={d.id} disputeStatus={d.status} viewerRole="admin" />
                    </div>

                    {d.resolution && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded p-2 text-xs text-emerald-700">
                        <strong>Résolution :</strong> {d.resolution}
                      </div>
                    )}

                    {(d.status === "open" || d.status === "under_review") && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Select
                            value={d.priority}
                            onValueChange={val => updateDispute(d.id, d.status, { priority: val })}
                          >
                            <SelectTrigger className="h-8 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_OPTIONS.map(p => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Textarea
                          placeholder="Résolution / décision..."
                          value={resolution}
                          onChange={e => setResolution(e.target.value)}
                          className="text-xs min-h-[50px]"
                        />
                        <div className="flex gap-2">
                          {d.status === "open" && (
                            <Button size="sm" variant="outline" onClick={() => updateDispute(d.id, "under_review")} disabled={processing === d.id}>
                              <MessageCircle size={12} className="mr-1" /> Prendre en charge
                            </Button>
                          )}
                          <Button size="sm" onClick={() => updateDispute(d.id, "resolved")} disabled={!resolution || processing === d.id}>
                            <CheckCircle2 size={12} className="mr-1" /> Résoudre
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateDispute(d.id, "closed")} disabled={processing === d.id}>
                            Fermer
                          </Button>
                        </div>
                      </div>
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
