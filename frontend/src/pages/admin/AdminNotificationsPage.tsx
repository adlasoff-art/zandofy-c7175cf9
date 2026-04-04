import { AdminLayout } from "@/components/admin/AdminLayout";
import { Bell, Mail, Smartphone, Send, Users, Store, Truck, Bike, Loader2, CheckCircle, XCircle, TestTube } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Input } from "@/components/ui/input";

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

  // Email test
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);

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

      let userIds: string[] = [];
      const role = audienceToRole[audience];

      if (audience === "all") {
        const { data } = await supabase.from("profiles").select("id");
        userIds = (data ?? []).map((p) => p.id);
      } else if (role) {
        const { data } = await supabase.from("user_roles").select("user_id").eq("role", role as any);
        userIds = (data ?? []).map((r) => r.user_id);
      } else {
        const { data: allProfiles } = await supabase.from("profiles").select("id");
        const { data: allRoles } = await supabase.from("user_roles").select("user_id");
        const roleUserIds = new Set((allRoles ?? []).map((r) => r.user_id));
        userIds = (allProfiles ?? []).filter((p) => !roleUserIds.has(p.id)).map((p) => p.id);
      }

      if (userIds.length === 0) throw new Error("Aucun destinataire trouvé");

      // Insert in-app notifications
      const rows = userIds.map((uid) => ({
        user_id: uid,
        title: title.trim(),
        message: message.trim(),
        type: channel,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("notifications").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      // If email channel, also send real emails via send-email edge function
      if (channel === "email") {
        // Get emails for user IDs
        const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userIds);
        const emails = (profiles ?? []).filter((p) => p.email).map((p) => p.email);
        
        // Send in batches of 10
        for (let i = 0; i < emails.length; i += 10) {
          const batch = emails.slice(i, i + 10);
          await Promise.allSettled(
            batch.map((email) =>
              supabase.functions.invoke("send-email", {
                body: {
                  to: email,
                  subject: title.trim(),
                  html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
                    <h2 style="color:#1a1a1a;margin:0 0 16px;">${title.trim()}</h2>
                    <p style="color:#555;line-height:1.6;">${message.trim()}</p>
                    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
                    <p style="color:#aaa;font-size:12px;">Zandofy — Votre marketplace de confiance</p>
                  </div>`,
                },
              })
            )
          );
        }
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

  // ── Email deliverability tester ──
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      if (!testEmail.trim()) throw new Error("Email requis");
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail.trim(),
          subject: "🧪 Test de délivrabilité — Zandofy",
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
            <h2 style="color:#1a1a1a;margin:0 0 16px;">✅ Test de délivrabilité réussi</h2>
            <p style="color:#555;line-height:1.6;">Si vous recevez cet email, la configuration SMTP de la plateforme fonctionne correctement.</p>
            <p style="color:#555;line-height:1.6;">Date du test : ${new Date().toLocaleString("fr-FR")}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="color:#aaa;font-size:12px;">Zandofy — Votre marketplace de confiance</p>
          </div>`,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTestResult({ ok: true, detail: "Email envoyé avec succès. Vérifiez la boîte de réception." });
    },
    onError: (e: any) => {
      setTestResult({ ok: false, detail: e.message || "Erreur lors de l'envoi" });
    },
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

        {/* Right column: Recent + Email tester */}
        <div className="space-y-4">
          {/* Email deliverability tester */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <TestTube size={16} className="text-primary" />
              Test de délivrabilité email
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Envoyez un email test à n'importe quelle adresse pour vérifier que les emails fonctionnent.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => { setTestEmail(e.target.value); setTestResult(null); }}
                placeholder="email@exemple.com"
                className="flex-1 h-9 text-sm"
              />
              <button
                onClick={() => testEmailMutation.mutate()}
                disabled={testEmailMutation.isPending || !testEmail.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {testEmailMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Tester
              </button>
            </div>
            {testResult && (
              <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 text-sm ${
                testResult.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
              }`}>
                {testResult.ok ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                <span className="text-xs">{testResult.detail}</span>
              </div>
            )}
          </div>

          {/* Recent notifications */}
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
      </div>
    </AdminLayout>
  );
}
