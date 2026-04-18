import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Megaphone, Cookie, Plus, Trash2, Save, Loader2, Eye, Zap } from "lucide-react";
import { AdminAutomationsTab } from "@/components/admin/AdminAutomationsTab";

interface PopupRow {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  link: string | null;
  link_label: string | null;
  is_active: boolean;
  display_frequency: string;
  start_date: string | null;
  end_date: string | null;
}

interface CookieConfig {
  enabled: boolean;
  message: string;
  accept_label: string;
  decline_label: string;
  analytics_enabled: boolean;
  marketing_enabled: boolean;
}

const DEFAULT_COOKIE: CookieConfig = {
  enabled: false,
  message: "Nous utilisons des cookies pour améliorer votre expérience. En continuant, vous acceptez notre utilisation des cookies.",
  accept_label: "Accepter",
  decline_label: "Refuser",
  analytics_enabled: true,
  marketing_enabled: false,
};

export default function AdminPopupsPage() {
  const { toast } = useToast();
  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [cookie, setCookie] = useState<CookieConfig>(DEFAULT_COOKIE);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"popups" | "cookies" | "automations">("popups");

  // New popup form
  const [newPopup, setNewPopup] = useState({
    title: "",
    content: "",
    image_url: "",
    link: "",
    link_label: "En savoir plus",
    display_frequency: "once",
  });

  useEffect(() => {
    // Load popups
    supabase
      .from("cms_popups" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPopups((data as any) || []));

    // Load cookie config
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "cookie_settings")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setCookie({ ...DEFAULT_COOKIE, ...(data.value as any) });
      });
  }, []);

  const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  const handleCreatePopup = async () => {
    if (!newPopup.title) return;
    setSaving(true);
    const { error } = await supabase
      .from("cms_popups" as any)
      .insert({
        title: newPopup.title,
        content: newPopup.content,
        image_url: newPopup.image_url || null,
        link: newPopup.link || null,
        link_label: newPopup.link_label,
        display_frequency: newPopup.display_frequency,
        is_active: false,
      } as any);
    
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Popup créé" });
      setNewPopup({ title: "", content: "", image_url: "", link: "", link_label: "En savoir plus", display_frequency: "once" });
      // Reload
      const { data } = await supabase.from("cms_popups" as any).select("*").order("created_at", { ascending: false });
      setPopups((data as any) || []);
    }
    setSaving(false);
  };

  const togglePopup = async (id: string, active: boolean) => {
    await supabase.from("cms_popups" as any).update({ is_active: active } as any).eq("id", id);
    setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: active } : p)));
  };

  const deletePopup = async (id: string) => {
    await supabase.from("cms_popups" as any).delete().eq("id", id);
    setPopups((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Popup supprimé" });
  };

  const saveCookieConfig = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "cookie_settings", value: cookie as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuration cookies enregistrée" });
    }
    setSaving(false);
  };

  return (
    <AdminLayout title="Popups & Cookies">
      <div className="max-w-3xl space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {[
            { key: "popups" as const, label: "Annonces commerciales", icon: Megaphone },
            { key: "automations" as const, label: "Automations", icon: Zap },
            { key: "cookies" as const, label: "Gestion cookies", icon: Cookie },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === "popups" && (
          <div className="space-y-6">
            {/* Create new popup */}
            <section className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus size={16} /> Nouveau popup
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">Titre</label>
                  <input value={newPopup.title} onChange={(e) => setNewPopup((p) => ({ ...p, title: e.target.value }))} className={inputClass} placeholder="Soldes de printemps !" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">Contenu</label>
                  <textarea value={newPopup.content} onChange={(e) => setNewPopup((p) => ({ ...p, content: e.target.value }))} className={inputClass + " min-h-[80px] resize-y"} placeholder="Profitez de -30% sur tout le site..." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">URL image (optionnel)</label>
                  <input value={newPopup.image_url} onChange={(e) => setNewPopup((p) => ({ ...p, image_url: e.target.value }))} className={inputClass} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Lien (optionnel)</label>
                  <input value={newPopup.link} onChange={(e) => setNewPopup((p) => ({ ...p, link: e.target.value }))} className={inputClass} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Libellé du lien</label>
                  <input value={newPopup.link_label} onChange={(e) => setNewPopup((p) => ({ ...p, link_label: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Fréquence d'affichage</label>
                  <select value={newPopup.display_frequency} onChange={(e) => setNewPopup((p) => ({ ...p, display_frequency: e.target.value }))} className={inputClass}>
                    <option value="once">Une seule fois</option>
                    <option value="daily">Une fois par jour</option>
                    <option value="always">À chaque visite</option>
                  </select>
                </div>
              </div>
              <Button onClick={handleCreatePopup} disabled={saving || !newPopup.title} size="sm" className="gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
              </Button>
            </section>

            {/* Existing popups */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Popups existants ({popups.length})</h2>
              {popups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucun popup créé.</p>
              ) : (
                popups.map((p) => (
                  <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.content.slice(0, 80)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Fréquence : {p.display_frequency === "once" ? "1 fois" : p.display_frequency === "daily" ? "Quotidien" : "Toujours"}
                      </p>
                    </div>
                    <Switch checked={p.is_active} onCheckedChange={(v) => togglePopup(p.id, v)} />
                    <button onClick={() => deletePopup(p.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {tab === "automations" && <AdminAutomationsTab />}

        {tab === "cookies" && (
          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Cookie size={16} /> Bandeau de consentement aux cookies
            </h2>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Activer le bandeau cookies</p>
                <p className="text-xs text-muted-foreground">Affiche un bandeau de consentement RGPD/cookie aux visiteurs</p>
              </div>
              <Switch checked={cookie.enabled} onCheckedChange={(v) => setCookie((c) => ({ ...c, enabled: v }))} />
            </div>

            {cookie.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Message du bandeau</label>
                  <textarea value={cookie.message} onChange={(e) => setCookie((c) => ({ ...c, message: e.target.value }))} className={inputClass + " min-h-[60px] resize-y"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Libellé bouton "Accepter"</label>
                    <input value={cookie.accept_label} onChange={(e) => setCookie((c) => ({ ...c, accept_label: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Libellé bouton "Refuser"</label>
                    <input value={cookie.decline_label} onChange={(e) => setCookie((c) => ({ ...c, decline_label: e.target.value }))} className={inputClass} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Types de cookies collectés</h3>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">Cookies analytiques</p>
                      <p className="text-xs text-muted-foreground">Comprendre le comportement des utilisateurs (pages visitées, durée, etc.)</p>
                    </div>
                    <Switch checked={cookie.analytics_enabled} onCheckedChange={(v) => setCookie((c) => ({ ...c, analytics_enabled: v }))} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">Cookies marketing</p>
                      <p className="text-xs text-muted-foreground">Personnaliser les recommandations et offres ciblées</p>
                    </div>
                    <Switch checked={cookie.marketing_enabled} onCheckedChange={(v) => setCookie((c) => ({ ...c, marketing_enabled: v }))} />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  💡 Les données collectées via cookies sont conformes au RGPD. Les utilisateurs peuvent accepter ou refuser à tout moment.
                  L'admin peut utiliser ces informations pour mieux cibler les promotions et comprendre les parcours clients.
                </p>
              </div>
            )}

            <Button onClick={saveCookieConfig} disabled={saving} size="sm" className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
            </Button>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
