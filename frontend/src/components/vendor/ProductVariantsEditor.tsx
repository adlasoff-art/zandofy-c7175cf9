import { useState } from "react";
import { Plus, X, Palette, Ruler } from "lucide-react";

/* ── Size variant ── */
export interface SizeVariant {
  id?: string;
  size_label: string;
  region?: string;
  bust_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
}

/* ── Color variant ── */
export interface ColorVariant {
  id?: string;
  color_name: string;
  color_hex: string;
  image_url?: string | null;
}

const PRESET_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];

const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: "Noir", hex: "#000000" },
  { name: "Blanc", hex: "#FFFFFF" },
  { name: "Rouge", hex: "#EF4444" },
  { name: "Bleu", hex: "#3B82F6" },
  { name: "Vert", hex: "#22C55E" },
  { name: "Jaune", hex: "#EAB308" },
  { name: "Rose", hex: "#EC4899" },
  { name: "Orange", hex: "#F97316" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Gris", hex: "#6B7280" },
  { name: "Marron", hex: "#92400E" },
  { name: "Beige", hex: "#D2B48C" },
];

interface Props {
  sizes: SizeVariant[];
  colors: ColorVariant[];
  onSizesChange: (sizes: SizeVariant[]) => void;
  onColorsChange: (colors: ColorVariant[]) => void;
}

export function ProductVariantsEditor({ sizes, colors, onSizesChange, onColorsChange }: Props) {
  const [customSize, setCustomSize] = useState("");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");

  /* ── Sizes ── */
  const toggleSize = (label: string) => {
    const exists = sizes.find((s) => s.size_label === label);
    if (exists) {
      onSizesChange(sizes.filter((s) => s.size_label !== label));
    } else {
      onSizesChange([...sizes, { size_label: label }]);
    }
  };

  const addCustomSize = () => {
    const trimmed = customSize.trim().toUpperCase();
    if (!trimmed || sizes.some((s) => s.size_label === trimmed)) return;
    onSizesChange([...sizes, { size_label: trimmed }]);
    setCustomSize("");
  };

  const removeSize = (label: string) => {
    onSizesChange(sizes.filter((s) => s.size_label !== label));
  };

  /* ── Colors ── */
  const togglePresetColor = (preset: { name: string; hex: string }) => {
    const exists = colors.find((c) => c.color_hex.toLowerCase() === preset.hex.toLowerCase());
    if (exists) {
      onColorsChange(colors.filter((c) => c.color_hex.toLowerCase() !== preset.hex.toLowerCase()));
    } else {
      onColorsChange([...colors, { color_name: preset.name, color_hex: preset.hex }]);
    }
  };

  const addCustomColor = () => {
    const name = customColorName.trim();
    if (!name) return;
    if (colors.some((c) => c.color_hex.toLowerCase() === customColorHex.toLowerCase())) return;
    onColorsChange([...colors, { color_name: name, color_hex: customColorHex }]);
    setCustomColorName("");
    setCustomColorHex("#000000");
  };

  const removeColor = (hex: string) => {
    onColorsChange(colors.filter((c) => c.color_hex.toLowerCase() !== hex.toLowerCase()));
  };

  return (
    <div className="space-y-4">
      {/* ── Tailles ── */}
      <div className="border-t border-border pt-3">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <Ruler size={14} /> Tailles disponibles
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PRESET_SIZES.map((s) => {
            const active = sizes.some((sz) => sz.size_label === s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Custom sizes added */}
        {sizes.filter((s) => !PRESET_SIZES.includes(s.size_label)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {sizes
              .filter((s) => !PRESET_SIZES.includes(s.size_label))
              .map((s) => (
                <span
                  key={s.size_label}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground"
                >
                  {s.size_label}
                  <button type="button" onClick={() => removeSize(s.size_label)} className="hover:opacity-70">
                    <X size={12} />
                  </button>
                </span>
              ))}
          </div>
        )}

        {/* Add custom size */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Taille personnalisée…"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSize())}
            className="flex-1 px-3 py-1.5 text-xs bg-card border border-border rounded-md"
          />
          <button
            type="button"
            onClick={addCustomSize}
            className="px-3 py-1.5 text-xs font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 flex items-center gap-1"
          >
            <Plus size={12} /> Ajouter
          </button>
        </div>
      </div>

      {/* ── Couleurs ── */}
      <div className="border-t border-border pt-3">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <Palette size={14} /> Couleurs disponibles
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_COLORS.map((c) => {
            const active = colors.some((col) => col.color_hex.toLowerCase() === c.hex.toLowerCase());
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => togglePresetColor(c)}
                title={c.name}
                className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                  active ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border hover:scale-105"
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {active && (
                  <span className={`text-[10px] font-bold ${c.hex === "#FFFFFF" || c.hex === "#EAB308" || c.hex === "#D2B48C" ? "text-foreground" : "text-white"}`}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected colors labels */}
        {colors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {colors.map((c) => (
              <span
                key={c.color_hex}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md bg-card border border-border"
              >
                <span className="w-3 h-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: c.color_hex }} />
                {c.color_name}
                <button type="button" onClick={() => removeColor(c.color_hex)} className="text-muted-foreground hover:text-destructive">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add custom color */}
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={customColorHex}
            onChange={(e) => setCustomColorHex(e.target.value)}
            className="w-8 h-8 rounded-md border border-border cursor-pointer"
          />
          <input
            type="text"
            placeholder="Nom de la couleur…"
            value={customColorName}
            onChange={(e) => setCustomColorName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomColor())}
            className="flex-1 px-3 py-1.5 text-xs bg-card border border-border rounded-md"
          />
          <button
            type="button"
            onClick={addCustomColor}
            className="px-3 py-1.5 text-xs font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 flex items-center gap-1"
          >
            <Plus size={12} /> Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
