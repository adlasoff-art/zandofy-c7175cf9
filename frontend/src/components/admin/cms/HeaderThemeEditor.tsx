import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { HeaderTheme } from "@/hooks/use-header-theme";

const FIELDS: { key: keyof HeaderTheme; label: string }[] = [
  { key: "bg_color", label: "Fond du header" },
  { key: "text_color", label: "Texte du header" },
  { key: "icon_color", label: "Icônes du header" },
  { key: "badge_bg_color", label: "Fond badges (panier, wishlist)" },
  { key: "badge_text_color", label: "Texte badges" },
  { key: "nav_bg_color", label: "Fond barre de navigation" },
  { key: "nav_text_color", label: "Texte navigation" },
  { key: "nav_highlight_color", label: "Couleur Soldes / highlights" },
  { key: "scrollbar_color", label: "Barre de scroll navigation" },
];

const DEFAULTS: HeaderTheme = {
  bg_color: "", text_color: "", icon_color: "", badge_bg_color: "", badge_text_color: "",
  nav_bg_color: "", nav_text_color: "", nav_highlight_color: "", scrollbar_color: "",
};

export default function HeaderThemeEditor() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<HeaderTheme>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["header-theme"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "header_theme").maybeSingle();
      return { ...DEFAULTS, ...(data?.value as any || {}) } as HeaderTheme;
    },
  });

  useEffect(() => { if (data) setTheme(data); }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings")
      .upsert({ key: "header_theme", value: theme as any, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Thème header sauvegardé");
    queryClient.invalidateQueries({ queryKey: ["header-theme"] });
  };

  const reset = () => setTheme(DEFAULTS);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Thème du Header</h3>
        <div className="flex gap-2">
          <button onClick={reset} className="px-3 py-2 text-xs bg-muted rounded-lg hover:bg-muted/80">Réinitialiser</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Sauvegarder"}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Laissez un champ vide pour utiliser les couleurs par défaut du thème. Entrez un code hex (#FF0000) pour personnaliser.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="bg-card border border-border rounded-xl p-3">
            <label className="text-xs font-medium text-foreground block mb-2">{f.label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme[f.key] || "#000000"}
                onChange={(e) => setTheme(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <input
                type="text"
                value={theme[f.key]}
                onChange={(e) => setTheme(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-xs bg-muted border border-border rounded"
                placeholder="Par défaut"
              />
              {theme[f.key] && (
                <button onClick={() => setTheme(prev => ({ ...prev, [f.key]: "" }))} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
