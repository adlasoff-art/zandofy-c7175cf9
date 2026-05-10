import { AdminLayout } from "@/components/admin/AdminLayout";
import { Bell, Mail, Smartphone, Send, Users, Store, Truck, Bike, Loader2, CheckCircle, XCircle, TestTube, Settings, Calendar } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/admin/notifications/RichTextEditor";
import { GeoSegmentationFilter, type GeoFilter } from "@/components/admin/notifications/GeoSegmentationFilter";
import { UserSearchSelect, type SelectedUser } from "@/components/admin/notifications/UserSearchSelect";
import { SmsConfigPanel } from "@/components/admin/notifications/SmsConfigPanel";
import { CampaignsPanel } from "@/components/admin/notifications/CampaignsPanel";
import { ensureFreshSession, parseEdgeFunctionError } from "@/services/admin-email";
import { PwaUpdateBroadcastCard } from "@/components/admin/PwaUpdateBroadcastCard";

type Channel = "push" | "email" | "sms";
type Audience = "all" | "vendors" | "shippers" | "riders" | "customers";

const audienceToRole: Record<Audience, string | null> = {
  all: null, vendors: "vendor", shippers: "shipper", riders: "rider", customers: null,
};

const db = supabase as any;

export default function AdminNotificationsPage() {
  const [channel, setChannel] = useState<Channel>("push");
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [geoFilter, setGeoFilter] = useState<GeoFilter>({ country: "", province: "", city: "", commune: "", quartier: "" });
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [targetMode, setTargetMode] = useState<"audience" | "geo" | "user">("audience");
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

  // Resolve target user IDs based on mode
  const resolveUserIds = async (): Promise<string[]> => {
    if (targetMode === "user") {
      if (selectedUsers.length === 0) throw new Error("Sélectionnez au moins un utilisateur");
      return selectedUsers.map((u) => u.id);
    }

    if (targetMode === "geo") {
      // Filter profiles by geo fields
      let q = db.from("profiles").select("id");
      if (geoFilter.country) q = q.eq("residence_country", geoFilter.country);
      if (geoFilter.province) q = q.eq("residence_province", geoFilter.province);
      if (geoFilter.city) q = q.eq("residence_city", geoFilter.city);
      if (geoFilter.commune) q = q.eq("residence_commune", geoFilter.commune);
      if (geoFilter.quartier) q = q.eq("residence_quartier", geoFilter.quartier);

      // Also apply role filter from audience
      const role = audienceToRole[audience];
      if (role) {
        const { data: roleUsers } = await supabase.from("user_roles").select("user_id").eq("role", role as any);
        const roleIds = new Set((roleUsers ?? []).map((r) => r.user_id));
        const { data } = await q;
        return (data ?? []).map((p: any) => p.id).filter((id: string) => roleIds.has(id));
      } else if (audience === "customers") {
        const { data: allRoles } = await supabase.from("user_roles").select("user_id");
        const roleIds = new Set((allRoles ?? []).map((r) => r.user_id));
        const { data } = await q;
        return (data ?? []).map((p: any) => p.id).filter((id: string) => !roleIds.has(id));
      }

      const { data } = await q;
      return (data ?? []).map((p: any) => p.id);
    }

    // audience mode (original logic)
    const role = audienceToRole[audience];
    if (audience === "all") {
      const { data } = await supabase.from("profiles").select("id");
      return (data ?? []).map((p) => p.id);
    } else if (role) {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", role as any);
      return (data ?? []).map((r) => r.user_id);
    } else {
      const { data: allProfiles } = await supabase.from("profiles").select("id");
      const { data: allRoles } = await supabase.from("user_roles").select("user_id");
      const roleUserIds = new Set((allRoles ?? []).map((r) => r.user_id));
      return (allProfiles ?? []).filter((p) => !roleUserIds.has(p.id)).map((p) => p.id);
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Titre requis");
      if (channel !== "email" && !message.trim()) throw new Error("Message requis");
      if (channel === "email" && !htmlContent.trim() && !message.trim()) throw new Error("Contenu email requis");

      const userIds = await resolveUserIds();
      if (userIds.length === 0) throw new Error("Aucun destinataire trouvé pour ces critères");

      // Insert in-app notifications
      const rows = userIds.map((uid) => ({
        user_id: uid,
        title: title.trim(),
        message: message.trim() || title.trim(),
        type: channel === "email" ? "promo" : channel,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("notifications").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      // Send real emails
      if (channel === "email") {
        await ensureFreshSession();
        const { data: profiles } = await db.from("profiles").select("id, email, first_name").in("id", userIds);
        const recipients = (profiles ?? []).filter((p: any) => p.email);

        const emailHtml = htmlContent.trim() || `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
          <h2 style="color:#1a1a1a;margin:0 0 16px;">${title.trim()}</h2>
          <p style="color:#555;line-height:1.6;">${message.trim()}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#aaa;font-size:12px;">Zandofy — Votre marketplace de confiance</p>
        </div>`;

        // Send in batches of 10 with delays
        for (let i = 0; i < recipients.length; i += 10) {
          const batch = recipients.slice(i, i + 10);
          await Promise.allSettled(
            batch.map((r: any) =>
              supabase.functions.invoke("send-email", {
                body: {
                  to: r.email,
                  subject: title.trim(),
                  html: emailHtml.replace(/\{\{name\}\}/g, r.first_name || "Client"),
                },
              })
            )
          );
          // Wait 2 seconds between batches to avoid rate limiting
          if (i + 10 < recipients.length) await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // SMS channel
      if (channel === "sms") {
        const { data: smsConfig } = await db.from("sms_provider_config").select("*").eq("is_active", true).limit(1).single();
        if (!smsConfig) throw new Error("SMS non configuré. Allez dans l'onglet Configuration SMS.");

        const { data: profiles } = await db.from("profiles").select("id, phone, first_name").in("id", userIds);
        const recipients = (profiles ?? []).filter((p: any) => p.phone);
        if (recipients.length === 0) throw new Error("Aucun destinataire avec numéro de téléphone");

        // Call SMS edge function
        await supabase.functions.invoke("send-sms-batch", {
          body: {
            recipients: recipients.map((r: any) => ({ phone: r.phone, name: r.first_name })),
            message: message.trim(),
          },
        });
      }

      return userIds.length;
    },
    onSuccess: (count) => {
      toast.success(`Notification envoyée à ${count} utilisateur(s)`);
      setTitle("");
      setMessage("");
      setHtmlContent("");
      setSelectedUsers([]);
      queryClient.invalidateQueries({ queryKey: ["admin-sent-notifications"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur d'envoi"),
  });

  // Email deliverability tester
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      if (!testEmail.trim()) throw new Error("Email requis");
      await ensureFreshSession();
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
      if (error) {
        const msg = await parseEdgeFunctionError(error);
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: () => setTestResult({ ok: true, detail: "Email envoyé avec succès. Vérifiez la boîte de réception." }),
    onError: (e: any) => setTestResult({ ok: false, detail: e.message || "Erreur lors de l'envoi" }),
  });

  const hasGeoFilter = geoFilter.country || geoFilter.province || geoFilter.city || geoFilter.commune || geoFilter.quartier;

  return (
    <AdminLayout title="Centre de notifications">
      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="compose" className="text-xs gap-1"><Send size={12} /> Envoyer</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs gap-1"><Calendar size={12} /> Campagnes auto</TabsTrigger>
          <TabsTrigger value="sms-config" className="text-xs gap-1"><Settings size={12} /> Config SMS</TabsTrigger>
          <TabsTrigger value="deliverability" className="text-xs gap-1"><TestTube size={12} /> Test email</TabsTrigger>
          <TabsTrigger value="pwa-update" className="text-xs gap-1"><Bell size={12} /> Mise à jour PWA</TabsTrigger>
        </TabsList>

        {/* ── Tab: Compose & Send ── */}
        <TabsContent value="compose">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Nouvelle notification</h2>

              {/* Channel */}
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

              {/* Target mode selector */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Mode de ciblage</label>
                <div className="flex gap-1.5">
                  {[
                    { key: "audience" as const, label: "Par rôle" },
                    { key: "geo" as const, label: "Par zone géo" },
                    { key: "user" as const, label: "Utilisateur(s)" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setTargetMode(m.key)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        targetMode === m.key ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience filter (role based) */}
              {(targetMode === "audience" || targetMode === "geo") && (
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
              )}

              {/* Geo segmentation */}
              {targetMode === "geo" && (
                <GeoSegmentationFilter value={geoFilter} onChange={setGeoFilter} />
              )}

              {/* User search */}
              {targetMode === "user" && (
                <UserSearchSelect selectedUsers={selectedUsers} onChange={setSelectedUsers} />
              )}

              {/* Title */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Titre</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Nouvelle fonctionnalité disponible"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Message (for push/sms) */}
              {channel !== "email" && (
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
              )}

              {/* Rich text editor (for email) */}
              {channel === "email" && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Contenu email (texte enrichi)</label>
                  <RichTextEditor
                    value={htmlContent}
                    onChange={setHtmlContent}
                    placeholder="Composez votre email avec du gras, italique, images..."
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Variables : {"{{name}}"} sera remplacé par le prénom du destinataire</p>
                </div>
              )}

              {/* Send button */}
              <button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || !title.trim() || (channel !== "email" && !message.trim())}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors w-full justify-center disabled:opacity-50"
              >
                {sendMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sendMutation.isPending ? "Envoi en cours..." : "Envoyer"}
              </button>
            </div>

            {/* Recent notifications */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Notifications récentes</h2>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
              ) : recentNotifs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune notification envoyée</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
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
        </TabsContent>

        {/* ── Tab: Campaigns ── */}
        <TabsContent value="campaigns">
          <div className="bg-card border border-border rounded-xl p-5">
            <CampaignsPanel />
          </div>
        </TabsContent>

        {/* ── Tab: SMS Config ── */}
        <TabsContent value="sms-config">
          <div className="bg-card border border-border rounded-xl p-5 max-w-xl">
            <SmsConfigPanel />
          </div>
        </TabsContent>

        {/* ── Tab: Deliverability Test ── */}
        <TabsContent value="deliverability">
          <div className="bg-card border border-border rounded-xl p-5 max-w-xl">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <TestTube size={16} className="text-primary" />
              Test de délivrabilité email
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Envoyez un email test pour vérifier que la configuration SMTP fonctionne.
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
        </TabsContent>

        {/* ── Tab: PWA Update Broadcast ── */}
        <TabsContent value="pwa-update">
          <PwaUpdateBroadcastCard />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
