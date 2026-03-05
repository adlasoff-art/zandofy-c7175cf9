import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Headphones, Plus, ArrowLeft, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, apiWsUrl } from "@/services/api-client";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/contexts/I18nContext";

export interface SupportTicket {
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

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  is_staff: boolean;
  created_at: string;
}

interface SupportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: "order", label: "Commande" },
  { value: "delivery", label: "Livraison" },
  { value: "payment", label: "Paiement" },
  { value: "account", label: "Compte" },
  { value: "product", label: "Produit" },
  { value: "other", label: "Autre" },
];

export function SupportDrawer({ open, onOpenChange }: SupportDrawerProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "create" | "chat">("list");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("other");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);

  const token = session?.access_token ?? undefined;

  const fetchTickets = useCallback(async () => {
    if (!user || !token) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ tickets: SupportTicket[] }>("/api/support/tickets", { token });
      setTickets(data.tickets);
    } catch (err) {
      console.error("Fetch tickets error:", err);
      toast({ title: t("common.error") || "Erreur", description: "Impossible de charger les tickets", variant: "destructive" });
    }
    setLoading(false);
  }, [user, token, toast, t]);

  useEffect(() => {
    if (open && user) fetchTickets();
  }, [open, user, fetchTickets]);

  const handleCreate = async () => {
    if (!user || !subject.trim() || !message.trim() || !token) return;
    setLoading(true);
    try {
      const ticket = await apiFetch<SupportTicket>("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          initial_message: message.trim(),
        }),
        token,
      });
      setSubject("");
      setCategory("other");
      setMessage("");
      setTickets((prev) => [ticket, ...prev]);
      setSelectedTicket(ticket);
      setView("chat");
      setMessages([]);
      toast({ title: "Ticket créé", description: "Notre équipe vous répondra bientôt." });
    } catch (err) {
      toast({ title: t("common.error") || "Erreur", description: "Impossible de créer le ticket.", variant: "destructive" });
    }
    setLoading(false);
  };

  const openChat = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setView("chat");
    setMessages([]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Headphones size={20} /> {t("header.support") || "Service Client"}
          </SheetTitle>
        </SheetHeader>

        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center text-muted-foreground">
            <Headphones size={48} />
            <p>Connectez-vous pour accéder au support.</p>
          </div>
        ) : view === "create" ? (
          <div className="flex-1 flex flex-col gap-4 py-4">
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setView("list")}>
              <ArrowLeft size={16} className="mr-1" /> Retour
            </Button>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sujet</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Problème avec ma commande" maxLength={255} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez votre demande..."
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                maxLength={5000}
              />
            </div>
            <Button onClick={handleCreate} disabled={loading || !subject.trim() || !message.trim()}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Créer le ticket
            </Button>
          </div>
        ) : view === "chat" && selectedTicket ? (
          <SupportChatInner
            ticketId={selectedTicket.id}
            subject={selectedTicket.subject}
            token={token}
            messages={messages}
            setMessages={setMessages}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            sending={sending}
            setSending={setSending}
            onBack={() => { setView("list"); setSelectedTicket(null); setMessages([]); }}
            onOpenChange={onOpenChange}
          />
        ) : (
          <div className="flex-1 flex flex-col py-4">
            <Button className="w-full mb-4" onClick={() => setView("create")}>
              <Plus size={16} className="mr-2" /> Nouveau ticket
            </Button>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun ticket. Créez-en un pour nous contacter.</p>
            ) : (
              <div className="space-y-1 overflow-y-auto">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openChat(t)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium text-sm text-foreground truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.last_message_preview || t.status}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SupportChatInner({
  ticketId,
  subject,
  token,
  messages,
  setMessages,
  messageInput,
  setMessageInput,
  sending,
  setSending,
  onBack,
  onOpenChange,
}: {
  ticketId: string;
  subject: string;
  token: string | undefined;
  messages: SupportMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SupportMessage[]>>;
  messageInput: string;
  setMessageInput: (v: string) => void;
  sending: boolean;
  setSending: (v: boolean) => void;
  onBack: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    if (!ticketId || !token) return;

    (async () => {
      try {
        const data = await apiFetch<{ messages: SupportMessage[] }>(`/api/support/tickets/${ticketId}/messages`, { token });
        setMessages(data.messages);
      } catch (err) {
        console.error("Fetch messages error:", err);
      }
    })();

    const ws = new WebSocket(apiWsUrl(`/api/support/tickets/${ticketId}/ws`));
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
    };
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "new_message") {
          setMessages((prev) => [...prev, payload.data]);
        }
      } catch {}
    };
    ws.onerror = () => {};
    return () => { ws.close(); };
  }, [ticketId, token, setMessages]);

  const handleSend = async () => {
    if (!messageInput.trim() || !token || sending) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("content", messageInput.trim());
      await apiFetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        body: formData,
        token,
      });
      setMessageInput("");
    } catch (err) {
      console.error("Send message error:", err);
    }
    setSending(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Button variant="ghost" size="sm" className="w-fit mb-2" onClick={onBack}>
        <ArrowLeft size={16} className="mr-1" /> Retour
      </Button>
      <p className="text-sm font-medium text-foreground truncate mb-2">{subject}</p>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.is_staff ? "justify-start" : "justify-end"}`}
          >
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.is_staff ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.attachment_url && (
                <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-1 block">Pièce jointe</a>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Votre message..."
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !messageInput.trim()}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
