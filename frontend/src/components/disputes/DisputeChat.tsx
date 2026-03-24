import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Send, MessageCircle, Shield, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_role?: string;
}

interface DisputeChatProps {
  disputeId: string;
  disputeStatus: string;
  /** Role context: determines what label is shown for the current user */
  viewerRole: "client" | "vendor" | "admin";
}

export function DisputeChat({ disputeId, disputeStatus, viewerRole }: DisputeChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canReply = disputeStatus === "open" || disputeStatus === "under_review";

  const loadMessages = async () => {
    setLoading(true);
    const { data: msgs } = await supabase
      .from("dispute_messages")
      .select("id, dispute_id, sender_id, content, created_at")
      .eq("dispute_id", disputeId)
      .order("created_at", { ascending: true });

    if (msgs && msgs.length > 0) {
      const senderIds = [...new Set(msgs.map(m => m.sender_id))];
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name").in("id", senderIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", senderIds),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Utilisateur"]));
      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

      setMessages(msgs.map(m => ({
        ...m,
        sender_name: profileMap.get(m.sender_id) || "Utilisateur",
        sender_role: roleMap.get(m.sender_id) || "client",
      })));
    } else {
      setMessages([]);
    }
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => { loadMessages(); }, [disputeId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`dispute-chat-${disputeId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "dispute_messages",
        filter: `dispute_id=eq.${disputeId}`,
      }, () => { loadMessages(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [disputeId]);

  const handleSend = async () => {
    if (!reply.trim() || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: disputeId,
      sender_id: user.id,
      content: reply.trim(),
    });
    if (error) toast.error("Erreur lors de l'envoi");
    else { setReply(""); }
    setSending(false);
  };

  const getRoleIcon = (role?: string) => {
    if (role === "admin" || role === "manager") return <Shield size={10} className="text-primary" />;
    if (role === "vendor") return <Store size={10} className="text-amber-600" />;
    return <User size={10} className="text-muted-foreground" />;
  };

  const getRoleLabel = (role?: string) => {
    if (role === "admin" || role === "manager") return "Admin";
    if (role === "vendor") return "Vendeur";
    return "Client";
  };

  return (
    <div className="flex flex-col">
      <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
        <MessageCircle size={14} className="text-primary" /> Messagerie du litige
      </h4>

      <div className="max-h-80 overflow-y-auto space-y-2 mb-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={16} /></div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Aucun message. Envoyez le premier message.</p>
        ) : (
          messages.map(m => {
            const isOwn = m.sender_id === user?.id;
            return (
              <div key={m.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] px-3 py-2 rounded-lg text-xs",
                  isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {getRoleIcon(m.sender_role)}
                    <span className={cn("font-semibold text-[10px]", isOwn ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {isOwn ? "Vous" : m.sender_name} · {getRoleLabel(m.sender_role)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className={cn("text-[10px] mt-1", isOwn ? "text-primary-foreground/50" : "text-muted-foreground")}>
                    {new Date(m.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canReply ? (
        <div className="flex gap-2">
          <input
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Votre message..."
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          />
          <Button size="sm" onClick={handleSend} disabled={sending || !reply.trim()}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">Ce litige est {disputeStatus === "resolved" ? "résolu" : "fermé"}. Aucun nouveau message ne peut être envoyé.</p>
      )}
    </div>
  );
}
