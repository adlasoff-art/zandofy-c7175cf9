import { useState, useEffect } from "react";
import { Plus, X, Palette, Ruler, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

/* ── Dynamic variant selection ── */
export interface DynamicVariantSelection {
  variant_type_id: string;
  variant_option_id: string;
}

/* ── Custom vendor variant value ── */
export interface CustomVariantValue {
  variant_type_id: string;
  custom_label: string;
}

interface VariantType {
  id: string;
  name: string;
  unit: string;
  is_active: boolean;
  options: { id: string; label: string; sort_order: number }[];
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
  dynamicSelections: DynamicVariantSelection[];
  customVariantValues: CustomVariantValue[];
  onSizesChange: (sizes: SizeVariant[]) => void;
  onColorsChange: (colors: ColorVariant[]) => void;
  onDynamicSelectionsChange: (selections: DynamicVariantSelection[]) => void;
  onCustomVariantValuesChange: (values: CustomVariantValue[]) => void;
}

export function ProductVariantsEditor({ sizes, colors, dynamicSelections, customVariantValues, onSizesChange, onColorsChange, onDynamicSelectionsChange, onCustomVariantValuesChange }: Props) {
  const [customSize, setCustomSize] = useState("");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([]);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  // Load dynamic variant types
  useEffect(() => {
    async function load() {
      const { data: types } = await (supabase as any)
        .from("variant_types")
        .select("id, name, unit, is_active")
        .eq("is_active", true)
        .order("sort_order");

      if (!types || types.length === 0) { setVariantTypes([]); return; }

      const typeIds = types.map((t: any) => t.id);
      const { data: options } = await (supabase as any)
        .from("variant_type_options")
        .select("id, variant_type_id, label, sort_order")
        .in("variant_type_id", typeIds)
        .order("sort_order");

      const optMap = new Map<string, any[]>();
      (options || []).forEach((o: any) => {
        const arr = optMap.get(o.variant_type_id) || [];
        arr.push(o);
        optMap.set(o.variant_type_id, arr);
      });

      setVariantTypes(
        types.map((t: any) => ({ ...t, options: optMap.get(t.id) || [] }))
      );
    }
    load();
  }, []);

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

  /* ── Dynamic variants ── */
  const toggleDynamicOption = (typeId: string, optionId: string) => {
    const exists = dynamicSelections.find(
      (s) => s.variant_type_id === typeId && s.variant_option_id === optionId
    );
    if (exists) {
      onDynamicSelectionsChange(
        dynamicSelections.filter(
          (s) => !(s.variant_type_id === typeId && s.variant_option_id === optionId)
        )
      );
    } else {
      onDynamicSelectionsChange([
        ...dynamicSelections,
        { variant_type_id: typeId, variant_option_id: optionId },
      ]);
    }
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

      {/* ── Dynamic variant types ── */}
      {variantTypes.map((vt) => {
        const selectedForType = dynamicSelections.filter((s) => s.variant_type_id === vt.id);
        return (
          <div key={vt.id} className="border-t border-border pt-3">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
              <Layers size={14} /> {vt.name} {vt.unit && <span className="text-muted-foreground font-normal">({vt.unit})</span>}
            </label>
            {vt.options.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucune option disponible pour ce type.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {vt.options.map((opt) => {
                  const active = selectedForType.some((s) => s.variant_option_id === opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleDynamicOption(vt.id, opt.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
