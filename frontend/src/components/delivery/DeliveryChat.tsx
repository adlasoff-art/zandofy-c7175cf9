import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fromTable } from "@/lib/supabase-helpers";

interface DeliveryChatProps {
  orderId: string;
  deliveryId?: string | null;
  otherPartyName?: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export function DeliveryChat({ orderId, deliveryId, otherPartyName = "Interlocuteur" }: DeliveryChatProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(0);

  // Load messages
  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    fromTable("delivery_chats")
      .select("id, sender_id, message, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .then(({ data }: any) => {
        setMessages(data || []);
        setLoading(false);
        setUnread(0);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
      });
  }, [open, orderId]);

  // Realtime subscription
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`delivery-chat-${orderId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "delivery_chats",
        filter: `order_id=eq.${orderId}`,
      }, (payload: any) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => [...prev, msg]);
        if (!open && msg.sender_id !== user?.id) {
          setUnread((u) => u + 1);
        }
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight || 0, behavior: "smooth" }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, open, user?.id]);

  const sendMessage = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const payload: any = {
      order_id: orderId,
      sender_id: user.id,
      message: text.trim(),
    };
    if (deliveryId) payload.delivery_id = deliveryId;
    await fromTable("delivery_chats").insert(payload);
    setText("");
    setSending(false);
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(true); setUnread(0); }}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 touch-manipulation"
      >
        <MessageCircle size={22} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Header */}
          <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
            <button onClick={() => setOpen(false)} className="text-muted-foreground active:scale-95 touch-manipulation">
              <X size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{otherPartyName}</p>
              <p className="text-[10px] text-muted-foreground">Chat de livraison · éphémère</p>
            </div>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>}
            {!loading && messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Aucun message. Commencez la conversation !</p>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === user.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={`text-[9px] mt-0.5 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="bg-card border-t border-border p-3 flex items-center gap-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Votre message..."
              className="flex-1 px-3 py-2 bg-muted border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={sendMessage}
              disabled={!text.trim() || sending}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 touch-manipulation disabled:opacity-50"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
