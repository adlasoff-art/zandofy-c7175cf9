import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2, RotateCcw } from "lucide-react";

interface ColorConfig {
  badge_new: string;
  badge_sale: string;
  badge_hot: string;
  feature_bg: string;
  feature_text: string;
  promo_banner_bg: string;
  promo_banner_text: string;
  category_highlight: string;
}

const DEFAULT_COLORS: ColorConfig = {
  badge_new: "#22c55e",
  badge_sale: "#ef4444",
  badge_hot: "#f97316",
  feature_bg: "#f0fdf4",
  feature_text: "#166534",
  promo_banner_bg: "#1e293b",
  promo_banner_text: "#ffffff",
  category_highlight: "#8b5cf6",
};

const COLOR_LABELS: Record<keyof ColorConfig, string> = {
  badge_new: "Badge « Nouveau »",
  badge_sale: "Badge « Solde »",
  badge_hot: "Badge « Populaire »",
  feature_bg: "Fond features produit",
  feature_text: "Texte features produit",
  promo_banner_bg: "Fond bannière promo",
  promo_banner_text: "Texte bannière promo",
  category_highlight: "Surbrillance catégorie",
};

export function ColorPaletteEditor() {
  const { toast } = useToast();
  const [colors, setColors] = useState<ColorConfig>(DEFAULT_COLORS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "color_palette")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          setColors({ ...DEFAULT_COLORS, ...(data.value as any) });
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      { key: "color_palette", value: colors as any, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Palette de couleurs enregistrée" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">Définissez les couleurs utilisées pour les badges, features et bannières promotionnelles.</p>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Badges produits</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["badge_new", "badge_sale", "badge_hot"] as const).map((key) => (
            <ColorInput key={key} label={COLOR_LABELS[key]} value={colors[key]} onChange={(v) => setColors(c => ({ ...c, [key]: v }))} />
          ))}
        </div>
        {/* Preview */}
        <div className="flex gap-2 pt-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: colors.badge_new }}>NOUVEAU</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: colors.badge_sale }}>-30%</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: colors.badge_hot }}>POPULAIRE</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Features & caractéristiques</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorInput label={COLOR_LABELS.feature_bg} value={colors.feature_bg} onChange={(v) => setColors(c => ({ ...c, feature_bg: v }))} />
          <ColorInput label={COLOR_LABELS.feature_text} value={colors.feature_text} onChange={(v) => setColors(c => ({ ...c, feature_text: v }))} />
        </div>
        <div className="pt-2">
          <span className="text-xs px-3 py-1 rounded-md font-medium" style={{ backgroundColor: colors.feature_bg, color: colors.feature_text }}>
            ✓ Livraison gratuite
          </span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Bannière promotionnelle</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorInput label={COLOR_LABELS.promo_banner_bg} value={colors.promo_banner_bg} onChange={(v) => setColors(c => ({ ...c, promo_banner_bg: v }))} />
          <ColorInput label={COLOR_LABELS.promo_banner_text} value={colors.promo_banner_text} onChange={(v) => setColors(c => ({ ...c, promo_banner_text: v }))} />
        </div>
        <div className="rounded-lg px-4 py-2 text-center text-sm font-semibold" style={{ backgroundColor: colors.promo_banner_bg, color: colors.promo_banner_text }}>
          🔥 Soldes d'été — Jusqu'à -50% sur tout le site
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Catégories</h3>
        <ColorInput label={COLOR_LABELS.category_highlight} value={colors.category_highlight} onChange={(v) => setColors(c => ({ ...c, category_highlight: v }))} />
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer
        </Button>
        <Button variant="outline" onClick={() => setColors(DEFAULT_COLORS)} className="gap-2">
          <RotateCcw size={14} /> Réinitialiser
        </Button>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded border border-input cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="h-9 text-sm flex-1 font-mono" />
      </div>
    </div>
  );
}
