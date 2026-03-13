import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2, RotateCcw, Eye } from "lucide-react";
import type { ThemeColors } from "@/hooks/use-cms-theme";

interface BadgeColors {
  badge_new: string;
  badge_sale: string;
  badge_hot: string;
  promo_banner_bg: string;
  promo_banner_text: string;
  category_highlight: string;
}

const DEFAULT_THEME: ThemeColors = {
  primary_h: 120, primary_s: 100, primary_l: 25,
  accent_h: 120, accent_s: 76, accent_l: 55,
  destructive_h: 0, destructive_s: 84, destructive_l: 60,
  badge_new: "#22c55e",
  badge_sale: "#ef4444",
  badge_hot: "#f97316",
  promo_banner_bg: "#1e293b",
  promo_banner_text: "#ffffff",
  category_highlight: "#8b5cf6",
};

export function ColorPaletteEditor() {
  const { toast } = useToast();
  const [theme, setTheme] = useState<ThemeColors>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "theme_colors")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          setTheme({ ...DEFAULT_THEME, ...(data.value as any) });
        }
        setLoading(false);
      });
  }, []);

  const handlePreview = () => {
    const root = document.documentElement;
    root.style.setProperty("--primary", `${theme.primary_h} ${theme.primary_s}% ${theme.primary_l}%`);
    root.style.setProperty("--accent", `${theme.accent_h} ${theme.accent_s}% ${theme.accent_l}%`);
    root.style.setProperty("--ring", `${theme.primary_h} ${theme.primary_s}% ${theme.primary_l}%`);
    root.style.setProperty("--brand-gradient", `linear-gradient(135deg, hsl(${theme.primary_h} ${theme.primary_s}% ${theme.primary_l}%), hsl(${theme.accent_h} ${theme.accent_s}% ${theme.accent_l}%))`);
    setPreviewing(true);
    toast({ title: "Prévisualisation active", description: "Rechargez pour annuler." });
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      { key: "theme_colors", value: theme as any, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    // Also save legacy color_palette for backward compat
    await supabase.from("platform_settings").upsert(
      {
        key: "color_palette",
        value: {
          badge_new: theme.badge_new,
          badge_sale: theme.badge_sale,
          badge_hot: theme.badge_hot,
          feature_bg: "#f0fdf4",
          feature_text: "#166534",
          promo_banner_bg: theme.promo_banner_bg,
          promo_banner_text: theme.promo_banner_text,
          category_highlight: theme.category_highlight,
        } as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Thème enregistré", description: "Rechargez la page pour voir les changements appliqués." });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted-foreground">Personnalisez les couleurs principales de la plateforme. Les modifications s'appliquent globalement (frontend client, vendeur, admin).</p>

      {/* ─── Platform Theme ─── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">🎨 Couleurs principales</h3>
        <p className="text-xs text-muted-foreground">Ces couleurs définissent l'identité visuelle globale de la plateforme (boutons, liens, accents).</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <HslInput label="Primaire (boutons, liens)" h={theme.primary_h} s={theme.primary_s} l={theme.primary_l} onChange={(h, s, l) => setTheme(t => ({ ...t, primary_h: h, primary_s: s, primary_l: l }))} />
          <HslInput label="Accent (surbrillance)" h={theme.accent_h} s={theme.accent_s} l={theme.accent_l} onChange={(h, s, l) => setTheme(t => ({ ...t, accent_h: h, accent_s: s, accent_l: l }))} />
          <HslInput label="Destructif (erreurs)" h={theme.destructive_h} s={theme.destructive_s} l={theme.destructive_l} onChange={(h, s, l) => setTheme(t => ({ ...t, destructive_h: h, destructive_s: s, destructive_l: l }))} />
        </div>
        {/* Preview swatch */}
        <div className="flex gap-3 pt-2">
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-lg shadow-sm" style={{ backgroundColor: `hsl(${theme.primary_h}, ${theme.primary_s}%, ${theme.primary_l}%)` }} />
            <span className="text-[10px] text-muted-foreground">Primaire</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-lg shadow-sm" style={{ backgroundColor: `hsl(${theme.accent_h}, ${theme.accent_s}%, ${theme.accent_l}%)` }} />
            <span className="text-[10px] text-muted-foreground">Accent</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-lg shadow-sm" style={{ backgroundColor: `hsl(${theme.destructive_h}, ${theme.destructive_s}%, ${theme.destructive_l}%)` }} />
            <span className="text-[10px] text-muted-foreground">Destructif</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-lg shadow-sm" style={{ background: `linear-gradient(135deg, hsl(${theme.primary_h}, ${theme.primary_s}%, ${theme.primary_l}%), hsl(${theme.accent_h}, ${theme.accent_s}%, ${theme.accent_l}%))` }} />
            <span className="text-[10px] text-muted-foreground">Dégradé</span>
          </div>
        </div>
      </div>

      {/* ─── Badge Colors ─── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">🏷️ Badges produits</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorInput label="Badge « Nouveau »" value={theme.badge_new} onChange={(v) => setTheme(t => ({ ...t, badge_new: v }))} />
          <ColorInput label="Badge « Solde »" value={theme.badge_sale} onChange={(v) => setTheme(t => ({ ...t, badge_sale: v }))} />
          <ColorInput label="Badge « Populaire »" value={theme.badge_hot} onChange={(v) => setTheme(t => ({ ...t, badge_hot: v }))} />
        </div>
        <div className="flex gap-2 pt-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: theme.badge_new }}>NOUVEAU</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: theme.badge_sale }}>-30%</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: theme.badge_hot }}>POPULAIRE</span>
        </div>
      </div>

      {/* ─── Promo Banner ─── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">📢 Bannière promo & catégories</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorInput label="Fond bannière promo" value={theme.promo_banner_bg} onChange={(v) => setTheme(t => ({ ...t, promo_banner_bg: v }))} />
          <ColorInput label="Texte bannière promo" value={theme.promo_banner_text} onChange={(v) => setTheme(t => ({ ...t, promo_banner_text: v }))} />
          <ColorInput label="Surbrillance catégorie" value={theme.category_highlight} onChange={(v) => setTheme(t => ({ ...t, category_highlight: v }))} />
        </div>
        <div className="rounded-lg px-4 py-2 text-center text-sm font-semibold" style={{ backgroundColor: theme.promo_banner_bg, color: theme.promo_banner_text }}>
          🔥 Soldes d'été — Jusqu'à -50% sur tout le site
        </div>
      </div>

      {/* ─── Actions ─── */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer le thème
        </Button>
        <Button variant="outline" onClick={handlePreview} className="gap-2">
          <Eye size={14} /> Prévisualiser
        </Button>
        <Button variant="outline" onClick={() => setTheme(DEFAULT_THEME)} className="gap-2">
          <RotateCcw size={14} /> Réinitialiser
        </Button>
      </div>
    </div>
  );
}

/* ─── HSL Input Group ─── */
function HslInput({ label, h, s, l, onChange }: { label: string; h: number; s: number; l: number; onChange: (h: number, s: number, l: number) => void }) {
  const hexPreview = hslToHex(h, s, l);
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded border border-input shrink-0" style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }} />
        <input
          type="color"
          value={hexPreview}
          onChange={(e) => {
            const [nh, ns, nl] = hexToHsl(e.target.value);
            onChange(nh, ns, nl);
          }}
          className="w-8 h-8 rounded border border-input cursor-pointer shrink-0"
        />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <div className="space-y-0.5">
          <span className="text-[9px] text-muted-foreground">H</span>
          <Input type="number" min={0} max={360} value={h} onChange={(e) => onChange(+e.target.value, s, l)} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-muted-foreground">S%</span>
          <Input type="number" min={0} max={100} value={s} onChange={(e) => onChange(h, +e.target.value, l)} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] text-muted-foreground">L%</span>
          <Input type="number" min={0} max={100} value={l} onChange={(e) => onChange(h, s, +e.target.value)} className="h-7 text-xs" />
        </div>
      </div>
    </div>
  );
}

/* ─── Hex Color Input ─── */
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

/* ─── Color Conversion Helpers ─── */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): [number, number, number] {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
