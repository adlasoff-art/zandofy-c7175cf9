import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { getColorDisplay } from "@/utils/colorName";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CartItemVariantEditorProps {
  cartItemId: string;
  productId: string;
  currentColor: string | null;
  currentSize: string | null;
}

interface ProductVariants {
  colors: Array<{ hex: string; name: string }>;
  sizes: string[];
}

export function CartItemVariantEditor({
  cartItemId,
  productId,
  currentColor,
  currentSize,
}: CartItemVariantEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [variants, setVariants] = useState<ProductVariants | null>(null);
  const [loading, setLoading] = useState(false);
  const { updateVariant } = useCart();
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [selectedSize, setSelectedSize] = useState(currentSize);

  // Fetch variants only when expanded
  useEffect(() => {
    if (!expanded || variants) return;
    setLoading(true);
    Promise.all([
      supabase.from("product_colors").select("color_hex, color_name").eq("product_id", productId),
      supabase.from("product_sizes").select("size_label").eq("product_id", productId),
    ]).then(([colorsRes, sizesRes]) => {
      setVariants({
        colors: (colorsRes.data || []).map((c: any) => ({ hex: c.color_hex, name: c.color_name || "" })),
        sizes: (sizesRes.data || []).map((s: any) => s.size_label),
      });
      setLoading(false);
    });
  }, [expanded, variants, productId]);

  const hasVariants = variants && (variants.colors.length > 0 || variants.sizes.length > 0);

  const handleApply = async () => {
    if (selectedColor !== currentColor || selectedSize !== currentSize) {
      await updateVariant(cartItemId, selectedColor, selectedSize);
    }
    setExpanded(false);
  };

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-primary hover:underline flex items-center gap-0.5"
      >
        Modifier les options
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-2 p-2 bg-background rounded border border-border space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Chargement…</p>
          ) : !hasVariants ? (
            <p className="text-xs text-muted-foreground">Aucune variante disponible</p>
          ) : (
            <>
              {/* Colors */}
              {variants!.colors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Couleur</p>
                  <div className="flex flex-wrap gap-1.5">
                    {variants!.colors.map((c) => {
                      const isActive = selectedColor === c.hex;
                      const display = getColorDisplay(c.hex);
                      return (
                        <button
                          key={c.hex}
                          onClick={() => setSelectedColor(c.hex)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            isActive ? "border-primary ring-1 ring-primary scale-110" : "border-border"
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={display?.name || c.name || c.hex}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {variants!.sizes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Taille</p>
                  <div className="flex flex-wrap gap-1">
                    {variants!.sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        className={`px-2 py-0.5 text-xs rounded border transition-all ${
                          selectedSize === s
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:border-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply button */}
              {(selectedColor !== currentColor || selectedSize !== currentSize) && (
                <button
                  onClick={handleApply}
                  className="w-full text-xs font-semibold py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Appliquer
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
