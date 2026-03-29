import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface TopBarMessage {
  text_fr: string;
  text_en: string;
  visible: boolean;
}

interface TopBarConfig {
  enabled: boolean;
  mode: "static" | "slide" | "marquee";
  bg_color: string;
  text_color: string;
  messages: TopBarMessage[];
}

const DEFAULTS: TopBarConfig = {
  enabled: true,
  mode: "static",
  bg_color: "#1a1a1a",
  text_color: "#ffffff",
  messages: [],
};

export default function TopBarEditor() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<TopBarConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["topbar-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "topbar_config")
        .maybeSingle();
      return { ...DEFAULTS, ...(data?.value as any || {}) } as TopBarConfig;
    },
  });

  useEffect(() => {
    if (data) setConfig(data);
  }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "topbar_config", value: config as any, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { toast.error("Erreur de sauvegarde"); return; }
    toast.success("Top bar sauvegardée");
    queryClient.invalidateQueries({ queryKey: ["topbar-config"] });
  };

  const updateMessage = (idx: number, field: keyof TopBarMessage, val: any) => {
    setConfig(prev => ({
      ...prev,
      messages: prev.messages.map((m, i) => i === idx ? { ...m, [field]: val } : m),
    }));
  };

  const addMessage = () => {
    setConfig(prev => ({
      ...prev,
      messages: [...prev.messages, { text_fr: "", text_en: "", visible: true }],
    }));
  };

  const removeMessage = (idx: number) => {
    setConfig(prev => ({
      ...prev,
      messages: prev.messages.filter((_, i) => i !== idx),
    }));
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Barre d'annonces (Top Bar)</h3>
        <button onClick={save} disabled={saving} className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : "Sauvegarder"}
        </button>
      </div>

      {/* Toggle & Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Visible</label>
          <Switch checked={config.enabled} onCheckedChange={(v) => setConfig(prev => ({ ...prev, enabled: v }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Mode d'affichage</label>
          <select
            value={config.mode}
            onChange={(e) => setConfig(prev => ({ ...prev, mode: e.target.value as any }))}
            className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg"
          >
            <option value="static">Statique</option>
            <option value="slide">Slide (défilement)</option>
            <option value="marquee">Marquee (continu)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Fond</label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.bg_color} onChange={(e) => setConfig(prev => ({ ...prev, bg_color: e.target.value }))} className="w-8 h-8 rounded border border-border cursor-pointer" />
              <input type="text" value={config.bg_color} onChange={(e) => setConfig(prev => ({ ...prev, bg_color: e.target.value }))} className="flex-1 px-2 py-1.5 text-xs bg-muted border border-border rounded" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Texte</label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.text_color} onChange={(e) => setConfig(prev => ({ ...prev, text_color: e.target.value }))} className="w-8 h-8 rounded border border-border cursor-pointer" />
              <input type="text" value={config.text_color} onChange={(e) => setConfig(prev => ({ ...prev, text_color: e.target.value }))} className="flex-1 px-2 py-1.5 text-xs bg-muted border border-border rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg overflow-hidden border border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1 bg-muted/50">Aperçu</div>
        <div style={{ backgroundColor: config.bg_color, color: config.text_color }} className="py-2 px-4 text-[11px] text-center">
          {config.messages.filter(m => m.visible).map(m => m.text_fr).join("  ·  ") || "Aucun message"}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">Messages</h4>
          <button onClick={addMessage} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80">
            <Plus size={12} /> Ajouter
          </button>
        </div>
        {config.messages.map((msg, idx) => (
          <div key={idx} className="bg-card border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium">Message {idx + 1}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => updateMessage(idx, "visible", !msg.visible)} className="p-1 text-muted-foreground hover:text-foreground">
                  {msg.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => removeMessage(idx)} className="p-1 text-destructive hover:text-destructive/80">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Français</label>
                <input
                  type="text"
                  value={msg.text_fr}
                  onChange={(e) => updateMessage(idx, "text_fr", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg"
                  placeholder="Texte en français..."
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">English</label>
                <input
                  type="text"
                  value={msg.text_en}
                  onChange={(e) => updateMessage(idx, "text_en", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg"
                  placeholder="English text..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
