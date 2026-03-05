import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/services/api-client";
import { Loader2, Headphones, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  order_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  last_message_preview?: string | null;
  unread_count?: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "open", label: "Ouvert" },
  { value: "in_progress", label: "En cours" },
  { value: "resolved", label: "Résolu" },
  { value: "closed", label: "Fermé" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "order", label: "Commande" },
  { value: "delivery", label: "Livraison" },
  { value: "payment", label: "Paiement" },
  { value: "account", label: "Compte" },
  { value: "product", label: "Produit" },
  { value: "other", label: "Autre" },
];

export default function AdminSupportPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? undefined;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status_filter", filterStatus);
      if (filterCategory !== "all") params.set("category", filterCategory);
      const data = await apiFetch<{ tickets: Ticket[]; total: number }>(
        `/api/support/tickets?${params.toString()}`
      );
      setTickets(data.tickets);
      setTotal(data.total);
    } catch (err) {
      console.error("Fetch tickets error:", err);
      toast.error("Impossible de charger les tickets");
    }
    setLoading(false);
  }, [token, filterStatus, filterCategory]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const updateStatus = async (ticketId: string, status: string) => {
    if (!token) return;
    setUpdatingId(ticketId);
    try {
      await apiFetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        token,
      });
      toast.success("Statut mis à jour");
      fetchTickets();
    } catch (err) {
      toast.error("Impossible de mettre à jour le statut");
    }
    setUpdatingId(null);
  };

  return (
    <AdminLayout title="Support client">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">{total} ticket(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare size={48} className="mx-auto mb-2 opacity-50" />
            <p>Aucun ticket.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Sujet</th>
                  <th className="text-left p-3 font-medium">Statut</th>
                  <th className="text-left p-3 font-medium">Catégorie</th>
                  <th className="text-left p-3 font-medium">Priorité</th>
                  <th className="text-left p-3 font-medium">Mis à jour</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-medium text-foreground truncate max-w-[200px]" title={t.subject}>{t.subject}</p>
                      {t.last_message_preview && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={t.last_message_preview}>{t.last_message_preview}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        t.status === "open" ? "bg-amber-100 text-amber-800" :
                        t.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                        t.status === "resolved" ? "bg-green-100 text-green-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {STATUS_OPTIONS.find((o) => o.value === t.status)?.label ?? t.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{CATEGORY_OPTIONS.find((o) => o.value === t.category)?.label ?? t.category}</td>
                    <td className="p-3 text-muted-foreground capitalize">{t.priority}</td>
                    <td className="p-3 text-muted-foreground">{format(new Date(t.updated_at), "dd MMM yyyy HH:mm", { locale: fr })}</td>
                    <td className="p-3">
                      <select
                        value={t.status}
                        onChange={(e) => updateStatus(t.id, e.target.value)}
                        disabled={updatingId === t.id}
                        className="h-8 rounded border border-input bg-background px-2 text-xs"
                      >
                        {STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {updatingId === t.id && <Loader2 size={14} className="inline ml-1 animate-spin" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
