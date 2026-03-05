import { AdminLayout } from "@/components/admin/AdminLayout";
import { Bell, Mail, Smartphone, Send, Users, Store, Truck, Bike, Loader2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Channel = "push" | "email" | "sms";
type Audience = "all" | "vendors" | "shippers" | "riders" | "customers";

const audienceToRole: Record<Audience, string | null> = {
  all: null, vendors: "vendor", shippers: "shipper", riders: "rider", customers: null,
};

export default function AdminNotificationsPage() {
  const [channel, setChannel] = useState<Channel>("push");
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const channelOptions: { key: Channel; label: string; icon: React.ElementType }[] = [
    { key: "push", label: "Push", icon: Bell },
    { key: "email", label: "Email", icon: Mail },
    { key: "sms", label: "SMS", icon: Smartphone },
  ];

  const audienceOptions: { key: Audience; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "Tous", icon: Users },
    { key: "vendors", label: "Vendeurs", icon: Store },
    { key: "shippers", label: "Transporteurs", icon: Truck },
    { key: "riders", label: "Livreurs", icon: Bike },
    { key: "customers", label: "Clients", icon: Users },
  ];

  // Fetch recent notifications from DB
  const { data: recentNotifs = [], isLoading } = useQuery({
    queryKey: ["admin-sent-notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, type, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !message.trim()) throw new Error("Titre et message requis");

      // Get target user IDs based on audience
      let userIds: string[] = [];
      const role = audienceToRole[audience];

      if (audience === "all") {
        const { data } = await supabase.from("profiles").select("id");
        userIds = (data ?? []).map((p) => p.id);
      } else if (role) {
        const { data } = await supabase.from("user_roles").select("user_id").eq("role", role as any);
        userIds = (data ?? []).map((r) => r.user_id);
      } else {
        // customers = profiles without any role
        const { data: allProfiles } = await supabase.from("profiles").select("id");
        const { data: allRoles } = await supabase.from("user_roles").select("user_id");
        const roleUserIds = new Set((allRoles ?? []).map((r) => r.user_id));
        userIds = (allProfiles ?? []).filter((p) => !roleUserIds.has(p.id)).map((p) => p.id);
      }

      if (userIds.length === 0) throw new Error("Aucun destinataire trouvé");

      // Insert notifications (batch)
      const rows = userIds.map((uid) => ({
        user_id: uid,
        title: title.trim(),
        message: message.trim(),
        type: channel,
      }));

      // Insert in chunks of 100
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("notifications").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      return userIds.length;
    },
    onSuccess: (count) => {
      toast.success(`Notification envoyée à ${count} utilisateur(s)`);
      setTitle("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-sent-notifications"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur d'envoi"),
  });

  return (
    <AdminLayout title="Centre de notifications">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compose */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Nouvelle notification</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Canal</label>
              <div className="flex gap-1.5">
                {channelOptions.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setChannel(c.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      channel === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                    }`}
                  >
                    <c.icon size={14} /> {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Audience</label>
              <div className="flex gap-1.5 flex-wrap">
                {audienceOptions.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setAudience(a.key)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      audience === a.key ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border"
                    }`}
                  >
                    <a.icon size={12} /> {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Titre</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Nouvelle fonctionnalité disponible"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Contenu du message..."
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !title.trim() || !message.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors w-full justify-center disabled:opacity-50"
            >
              {sendMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sendMutation.isPending ? "Envoi en cours..." : "Envoyer"}
            </button>
          </div>
        </div>

        {/* Recent */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Notifications récentes</h2>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
          ) : recentNotifs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune notification envoyée</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recentNotifs.map((n) => (
                <div key={n.id} className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {format(new Date(n.created_at), "d MMM HH:mm", { locale: fr })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <span className="text-[10px] mt-1 inline-block px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{n.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
