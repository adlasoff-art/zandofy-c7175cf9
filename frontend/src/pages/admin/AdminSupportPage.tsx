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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_PRIORITY_FILTER_OPTIONS,
  SUPPORT_REQUESTER_FILTER_OPTIONS,
  SUPPORT_STATUS_OPTIONS,
  supportCategoryLabel,
  supportPriorityLabel,
  supportRequesterLabel,
  supportStatusLabel,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/support";

interface TicketRow extends SupportTicket {
  display_email: string;
}

const statusTone: Record<string, string> = {
  open: "bg-secondary text-secondary-foreground border-transparent",
  in_progress: "bg-accent text-accent-foreground border-transparent",
  resolved: "bg-primary/15 text-primary border-primary/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const priorityTone: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-secondary text-secondary-foreground border-transparent",
  medium: "bg-secondary text-secondary-foreground border-transparent",
  high: "bg-primary/15 text-primary border-primary/30",
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
};

const requesterTone: Record<string, string> = {
  guest: "bg-muted text-muted-foreground border-border",
  client: "bg-secondary text-secondary-foreground border-transparent",
  vendor: "bg-accent text-accent-foreground border-transparent",
};

export default function AdminSupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterRequesterType, setFilterRequesterType] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      let query = fromTable("support_tickets").select("*").order("updated_at", { ascending: false });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterCategory !== "all") query = query.eq("category", filterCategory);
      if (filterPriority !== "all") query = query.eq("priority", filterPriority);
      if (filterRequesterType !== "all") query = query.eq("requester_type", filterRequesterType);

      const { data, error } = await query;
      if (error) throw error;

      const rawTickets = (data || []) as SupportTicket[];
      const profileUserIds = Array.from(
        new Set(
          rawTickets
            .filter((t) => t.user_id && t.requester_type !== "guest")
            .map((t) => t.user_id as string),
        ),
      );

      let profileMap = new Map<string, string>();
      if (profileUserIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", profileUserIds);

        if (profileError) {
          console.warn("Profiles lookup failed:", profileError.message);
        } else {
          profileMap = new Map(
            (profiles || []).map((p: any) => [
              p.id,
              p.email || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Non renseigné",
            ]),
          );
        }
      }

      const rows: TicketRow[] = rawTickets.map((ticket) => ({
        ...ticket,
        display_email:
          ticket.requester_email ||
          (ticket.user_id ? profileMap.get(ticket.user_id) : undefined) ||
          "Non renseigné",
      }));

      setTickets(rows);
    } catch (err: any) {
      console.error("Fetch tickets error:", err);
      toast.error("Impossible de charger les tickets");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCategory, filterPriority, filterRequesterType]);

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

      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
      setSelectedTicket((prev) => (prev && prev.id === ticketId ? { ...prev, status } : prev));
      toast.success("Statut mis à jour");
    } catch {
      toast.error("Impossible de mettre à jour le statut");
    } finally {
      setUpdatingId(null);
    }
  };

  if (selectedTicket) {
    return (
      <AdminLayout title="Support client">
        <AdminTicketChat
          ticket={selectedTicket}
          staffId={user?.id || ""}
          onBack={() => {
            setSelectedTicket(null);
            fetchTickets();
          }}
          onStatusChange={(s) => updateStatus(selectedTicket.id, s)}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Support client">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {SUPPORT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {SUPPORT_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {SUPPORT_PRIORITY_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={filterRequesterType}
            onChange={(e) => setFilterRequesterType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {SUPPORT_REQUESTER_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <span className="text-sm text-muted-foreground">{tickets.length} ticket(s)</span>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-border rounded-lg bg-card">
            <MessageSquare size={48} className="mx-auto mb-2 opacity-60" />
            <p>Aucun ticket trouvé avec ces filtres.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Sujet</th>
                  <th className="text-left p-3 font-medium">Demandeur</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Priorité</th>
                  <th className="text-left p-3 font-medium">Statut</th>
                  <th className="text-left p-3 font-medium">Catégorie</th>
                  <th className="text-left p-3 font-medium">Mis à jour</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <td className="p-3">
                      <p className="font-medium text-foreground truncate max-w-[260px]" title={ticket.subject}>
                        {ticket.subject}
                      </p>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs truncate max-w-[200px]">{ticket.display_email}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn("capitalize", requesterTone[ticket.requester_type || "client"] || requesterTone.client)}
                      >
                        {supportRequesterLabel(ticket.requester_type)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn("capitalize", priorityTone[ticket.priority] || priorityTone.medium)}
                      >
                        {supportPriorityLabel(ticket.priority)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn("capitalize", statusTone[ticket.status] || statusTone.open)}
                      >
                        {supportStatusLabel(ticket.status)}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{supportCategoryLabel(ticket.category)}</td>
                    <td className="p-3 text-muted-foreground">
                      {format(new Date(ticket.updated_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={ticket.status}
                        onChange={(e) => updateStatus(ticket.id, e.target.value)}
                        disabled={updatingId === ticket.id}
                        className="h-8 rounded border border-input bg-background px-2 text-xs"
                      >
                        {SUPPORT_STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {updatingId === ticket.id && <Loader2 size={14} className="inline ml-1 animate-spin" />}
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
  ticket: TicketRow;
  staffId: string;
  onBack: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await fromTable("support_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      setMessages((data || []) as SupportMessage[]);
    })();

    const channel = supabase
      .channel(`admin-support-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const msg = payload.new as SupportMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      await fromTable("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      if (ticket.status === "open") onStatusChange("in_progress");
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={16} className="mr-1" /> Retour
        </Button>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground truncate">
            {ticket.display_email} · {supportRequesterLabel(ticket.requester_type)} · {supportCategoryLabel(ticket.category)}
          </p>
        </div>

        <select
          value={ticket.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-xs"
        >
          {SUPPORT_STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 bg-muted/30 rounded-lg p-4 min-h-0">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.is_staff ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                message.is_staff
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              <p className="text-[10px] font-medium opacity-70 mb-0.5">
                {message.is_staff ? "Vous (Staff)" : message.sender_email || "Client"} · {format(new Date(message.created_at), "HH:mm", { locale: fr })}
              </p>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 mt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Répondre au ticket..."
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
        />
        <Button size="icon" onClick={send} disabled={sending || !input.trim()}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
