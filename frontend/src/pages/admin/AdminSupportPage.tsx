import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  user_email?: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  is_staff: boolean;
  created_at: string;
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
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterCategory, setFilterCategory] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      let query = fromTable("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterCategory !== "all") query = query.eq("category", filterCategory);

      const { data, error } = await query;
      if (error) throw error;

      const tkList = (data || []) as Ticket[];

      // Fetch user emails
      if (tkList.length > 0) {
        const userIds = [...new Set(tkList.map((t) => t.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", userIds);
        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.id, p.email || `${p.first_name || ""} ${p.last_name || ""}`.trim()])
        );
        tkList.forEach((t) => (t.user_email = profileMap.get(t.user_id) || "—"));
      }

      setTickets(tkList);
    } catch (err: any) {
      console.error("Fetch tickets error:", err);
      toast.error("Impossible de charger les tickets");
    }
    setLoading(false);
  }, [filterStatus, filterCategory]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const updateStatus = async (ticketId: string, status: string) => {
    setUpdatingId(ticketId);
    try {
      const { error } = await fromTable("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;
      toast.success("Statut mis à jour");
      fetchTickets();
    } catch {
      toast.error("Impossible de mettre à jour le statut");
    }
    setUpdatingId(null);
  };

  if (selectedTicket) {
    return (
      <AdminLayout title="Support client">
        <AdminTicketChat
          ticket={selectedTicket}
          staffId={user?.id || ""}
          onBack={() => { setSelectedTicket(null); fetchTickets(); }}
          onStatusChange={(s) => updateStatus(selectedTicket.id, s)}
        />
      </AdminLayout>
    );
  }

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
          <span className="text-sm text-muted-foreground">{tickets.length} ticket(s)</span>
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
                  <th className="text-left p-3 font-medium">Client</th>
                  <th className="text-left p-3 font-medium">Statut</th>
                  <th className="text-left p-3 font-medium">Catégorie</th>
                  <th className="text-left p-3 font-medium">Mis à jour</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedTicket(t)}>
                    <td className="p-3">
                      <p className="font-medium text-foreground truncate max-w-[200px]" title={t.subject}>{t.subject}</p>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs truncate max-w-[150px]">{t.user_email}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        t.status === "open" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        : t.status === "in_progress" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        : t.status === "resolved" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {STATUS_OPTIONS.find((o) => o.value === t.status)?.label ?? t.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{CATEGORY_OPTIONS.find((o) => o.value === t.category)?.label ?? t.category}</td>
                    <td className="p-3 text-muted-foreground">{format(new Date(t.updated_at), "dd MMM yyyy HH:mm", { locale: fr })}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
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

function AdminTicketChat({
  ticket,
  staffId,
  onBack,
  onStatusChange,
}: {
  ticket: Ticket;
  staffId: string;
  onBack: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await fromTable("support_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      setMessages((data || []) as Message[]);
    })();

    const channel = supabase
      .channel(`admin-support-${ticket.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${ticket.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticket.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await fromTable("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: staffId,
        content: input.trim(),
        is_staff: true,
      });
      if (error) throw error;
      setInput("");
      await fromTable("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticket.id);
      if (ticket.status === "open") onStatusChange("in_progress");
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Erreur d'envoi");
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={16} className="mr-1" /> Retour
        </Button>
        <div className="flex-1">
          <p className="font-medium text-foreground text-sm">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground">{ticket.user_email} · {CATEGORY_OPTIONS.find((o) => o.value === ticket.category)?.label}</p>
        </div>
        <select
          value={ticket.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-xs"
        >
          {STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 bg-muted/30 rounded-lg p-4 min-h-0">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.is_staff ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.is_staff ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
              <p className="text-[10px] font-medium opacity-70 mb-0.5">{m.is_staff ? "Vous (Staff)" : "Client"} · {format(new Date(m.created_at), "HH:mm", { locale: fr })}</p>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 mt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Répondre au client..."
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
        />
        <Button size="icon" onClick={send} disabled={sending || !input.trim()}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
