import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertTriangle, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Dispute {
  id: string;
  order_id: string;
  reason: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  order_ref?: string;
  customer_email?: string;
}

interface DisputeMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

export function VendorDisputesTab({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("disputes")
      .select("id, order_id, reason, description, status, priority, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const orderIds = [...new Set(data.map(d => d.order_id))];
      const { data: orders } = await supabase.from("orders").select("id, order_ref, user_id").in("id", orderIds);
      const orderMap = new Map((orders || []).map(o => [o.id, o]));
      const userIds = [...new Set((orders || []).map(o => o.user_id))];
      const { data: profiles } = userIds.length > 0 ? await supabase.from("profiles").select("id, email").in("id", userIds) : { data: [] };
      const emailMap = new Map((profiles || []).map(p => [p.id, p.email]));

      setDisputes(data.map(d => {
        const order = orderMap.get(d.order_id);
        return { ...d, order_ref: order?.order_ref || d.order_id.slice(0, 8), customer_email: order ? emailMap.get(order.user_id) || "Client" : "Client" };
      }));
    } else {
      setDisputes([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [storeId]);

  const loadMessages = async (disputeId: string) => {
    setMsgLoading(true);
    const { data } = await supabase.from("dispute_messages").select("*").eq("dispute_id", disputeId).order("created_at");
    setMessages((data || []) as DisputeMessage[]);
    setMsgLoading(false);
  };

  const handleSelect = (id: string) => {
    setSelectedDispute(id);
    loadMessages(id);
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedDispute || !user) return;
    setSending(true);
    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: selectedDispute,
      sender_id: user.id,
      content: reply.trim(),
    });
    if (error) toast.error(error.message);
    else { setReply(""); loadMessages(selectedDispute); toast.success("Message envoyé"); }
    setSending(false);
  };

  const priorityBadge = (p: string) => {
    if (p === "high" || p === "urgent") return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">{p === "urgent" ? "Urgent" : "Haute"}</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">Normal</span>;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", closed: "bg-muted text-muted-foreground" };
    const labels: Record<string, string> = { open: "Ouvert", resolved: "Résolu", closed: "Fermé" };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${map[s] || map.open}`}>{labels[s] || s}</span>;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  if (selectedDispute) {
    const dispute = disputes.find(d => d.id === selectedDispute);
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedDispute(null)} className="text-sm text-primary flex items-center gap-1">← Retour aux litiges</button>
        {dispute && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">{dispute.order_ref}</p>
              <div className="flex items-center gap-2">{priorityBadge(dispute.priority)}{statusBadge(dispute.status)}</div>
            </div>
            <p className="text-xs text-foreground"><strong>Motif :</strong> {dispute.reason}</p>
            {dispute.description && <p className="text-xs text-muted-foreground mt-1">{dispute.description}</p>}
          </div>
        )}

        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
            <MessageCircle size={14} className="text-primary" /> Messages
          </h4>
          {msgLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={16} /></div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun message.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
              {messages.map(m => (
                <div key={m.id} className={`p-2 rounded-lg text-xs ${m.sender_id === user?.id ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                  <p className="text-foreground">{m.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("fr-FR")}</p>
                </div>
              ))}
            </div>
          )}

          {dispute?.status === "open" && (
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Votre réponse..."
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={e => e.key === "Enter" && handleSendReply()}
              />
              <Button size="sm" onClick={handleSendReply} disabled={sending || !reply.trim()}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (disputes.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <AlertTriangle size={40} className="mx-auto text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">Aucun litige.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-primary" /> Litiges ({disputes.length})
      </h3>
      {disputes.map(d => (
        <button key={d.id} onClick={() => handleSelect(d.id)} className="w-full bg-card border border-border rounded-lg p-4 text-left hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-foreground">{d.order_ref}</p>
            <div className="flex items-center gap-2">{priorityBadge(d.priority)}{statusBadge(d.status)}</div>
          </div>
          <p className="text-[11px] text-muted-foreground">{d.customer_email} · {new Date(d.created_at).toLocaleDateString("fr-FR")}</p>
          <p className="text-xs text-foreground mt-1">{d.reason}</p>
        </button>
      ))}
    </div>
  );
}
