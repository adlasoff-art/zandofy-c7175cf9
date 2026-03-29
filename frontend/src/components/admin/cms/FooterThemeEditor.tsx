import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { FooterTheme } from "@/hooks/use-footer-theme";

const COLOR_FIELDS: { key: keyof FooterTheme; label: string }[] = [
  { key: "bg_color", label: "Fond du footer" },
  { key: "text_color", label: "Texte principal" },
  { key: "link_color", label: "Liens" },
  { key: "section_title_color", label: "Titres de sections" },
  { key: "guarantee_icon_color", label: "Icônes garanties" },
  { key: "guarantee_bg_color", label: "Fond zone garanties" },
  { key: "newsletter_btn_bg", label: "Bouton newsletter (fond)" },
  { key: "newsletter_btn_text", label: "Bouton newsletter (texte)" },
  { key: "newsletter_input_bg", label: "Champ email newsletter" },
  { key: "social_icon_color", label: "Icônes réseaux sociaux" },
  { key: "social_border_color", label: "Bordure icônes sociaux" },
];

const DEFAULTS: FooterTheme = {
  bg_color: "", text_color: "", link_color: "", guarantee_icon_color: "",
  guarantee_icon_style: "outline", guarantee_bg_color: "", newsletter_btn_bg: "",
  newsletter_btn_text: "", newsletter_input_bg: "", social_icon_color: "",
  social_border_color: "", section_title_color: "",
};

export default function FooterThemeEditor() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<FooterTheme>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["footer-theme"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "footer_theme").maybeSingle();
      return { ...DEFAULTS, ...(data?.value as any || {}) } as FooterTheme;
    },
  });

  useEffect(() => { if (data) setTheme(data); }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings")
      .upsert({ key: "footer_theme", value: theme as any, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Thème footer sauvegardé");
    queryClient.invalidateQueries({ queryKey: ["footer-theme"] });
  };

  const reset = () => setTheme(DEFAULTS);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Thème du Footer</h3>
        <div className="flex gap-2">
          <button onClick={reset} className="px-3 py-2 text-xs bg-muted rounded-lg hover:bg-muted/80">Réinitialiser</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Sauvegarder"}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Laissez vide pour les couleurs par défaut. Entrez un code hex pour personnaliser.</p>

      {/* Icon style toggle */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-foreground block mb-2">Style des icônes garanties</label>
        <div className="flex gap-2">
          {(["outline", "filled"] as const).map((style) => (
            <button
              key={style}
              onClick={() => setTheme(prev => ({ ...prev, guarantee_icon_style: style }))}
              className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                theme.guarantee_icon_style === style
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              {style === "outline" ? "Contour" : "Rempli"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COLOR_FIELDS.map((f) => (
          <div key={f.key} className="bg-card border border-border rounded-xl p-3">
            <label className="text-xs font-medium text-foreground block mb-2">{f.label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(theme[f.key] as string) || "#000000"}
                onChange={(e) => setTheme(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <input
                type="text"
                value={theme[f.key] as string}
                onChange={(e) => setTheme(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-xs bg-muted border border-border rounded"
                placeholder="Par défaut"
              />
              {(theme[f.key] as string) && (
                <button onClick={() => setTheme(prev => ({ ...prev, [f.key]: "" }))} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
