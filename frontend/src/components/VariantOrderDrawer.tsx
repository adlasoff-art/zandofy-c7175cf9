import { useState, useMemo, useCallback, useEffect } from "react";
import { X, ChevronDown, ChevronUp, ShoppingCart, Zap, TrendingUp, Truck, Target, Plus, Minus, Check } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculateTieredPrice, type PricingTier } from "@/components/TieredPricingTable";
import { PrecisionShippingEstimate } from "@/components/PrecisionShippingEstimate";
import { useNavigate } from "react-router-dom";
import type { Product } from "@/services/api";

interface ColorOption {
  hex: string;
  name: string;
  imageUrl?: string | null;
}

interface SizeOption {
  label: string;
  region?: string;
}

interface DynamicVariant {
  typeId: string;
  typeName: string;
  unit: string;
  icon: string;
  options: Array<{ id: string; label: string }>;
}

interface VariantRow {
  key: string;
  displayLabel: string;
  cartSize: string | null;
  quantity: number;
}

interface VariantSection {
  id: string;
  title: string;
  rows: VariantRow[];
}

interface SelectedItem {
  colorHex: string | null;
  colorName: string;
  size: string | null;
  quantity: number;
}

interface VariantOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  colors: ColorOption[];
  sizes: SizeOption[];
  pricingTiers: PricingTier[];
  moq: number;
  dynamicVariants?: DynamicVariant[];
}

function MiniQty({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="inline-flex items-center h-8 overflow-hidden border rounded-sm border-border">
      <button
        type="button"
        className="flex items-center justify-center w-7 h-8 transition-colors text-muted-foreground hover:bg-muted disabled:opacity-30"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Diminuer"
      >
        <Minus size={13} />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!Number.isNaN(v)) onChange(Math.max(min, v));
        }}
        className="w-10 h-8 text-xs font-medium text-center outline-none bg-background text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        min={min}
        aria-label="Quantité"
      />
      <button
        type="button"
        className="flex items-center justify-center w-7 h-8 transition-colors text-muted-foreground hover:bg-muted"
        onClick={() => onChange(value + 1)}
        aria-label="Augmenter"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

export function VariantOrderDrawer({
  open,
  onOpenChange,
  product,
  colors,
  sizes,
  pricingTiers,
  moq,
  dynamicVariants = [],
}: VariantOrderDrawerProps) {
  const isMobile = useIsMobile();
  const { addItem } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [variantQtys, setVariantQtys] = useState<Record<string, number>>({});
  const [subtotalExpanded, setSubtotalExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      setVariantQtys({});
      setSelectedColorIdx(0);
      setSubtotalExpanded(false);
    }
  }, [open]);

  const currentColorName = colors[selectedColorIdx]?.name || colors[selectedColorIdx]?.hex || "Standard";

  const variantSections = useMemo<VariantSection[]>(() => {
    const sections: VariantSection[] = [];

    if (sizes.length > 0) {
      sections.push({
        id: "sizes",
        title: "Tailles & Quantités",
        rows: sizes.map((size) => {
          const key = `${currentColorName}|||size|||${size.label}`;
          return {
            key,
            displayLabel: size.label,
            cartSize: size.label,
            quantity: variantQtys[key] || 0,
          };
        }),
      });
    }

    dynamicVariants.forEach((variant) => {
      if (variant.options.length === 0) return;
      sections.push({
        id: `dynamic-${variant.typeId}`,
        title: `${variant.icon ? `${variant.icon} ` : ""}${variant.typeName}${variant.unit ? ` (${variant.unit})` : ""} & Quantités`,
        rows: variant.options.map((option) => {
          const key = `${currentColorName}|||dynamic|||${variant.typeId}|||${option.id}`;
          return {
            key,
            displayLabel: option.label,
            cartSize: `${variant.typeName}: ${option.label}`,
            quantity: variantQtys[key] || 0,
          };
        }),
      });
    });

    if (sections.length === 0) {
      const key = `${currentColorName}|||default`;
      sections.push({
        id: "default",
        title: "Quantité",
        rows: [
          {
            key,
            displayLabel: "",
            cartSize: null,
            quantity: variantQtys[key] || 0,
          },
        ],
      });
    }

    return sections;
  }, [currentColorName, dynamicVariants, sizes, variantQtys]);

  const flattenedVariantRows = useMemo(
    () => variantSections.flatMap((section) => section.rows),
    [variantSections]
  );

  const totalQty = useMemo(
    () => Object.values(variantQtys).reduce((sum, qty) => sum + qty, 0),
    [variantQtys]
  );

  const tieredResult = useMemo(() => {
    if (pricingTiers.length === 0) return null;
    return calculateTieredPrice(Math.max(totalQty, 1), pricingTiers, product.price);
  }, [pricingTiers, product.price, totalQty]);

  const unitPrice = tieredResult?.unitPrice ?? product.price;
  const subtotalAmount = unitPrice * totalQty;

  const sortedTiers = useMemo(
    () => [...pricingTiers].sort((a, b) => a.minQuantity - b.minQuantity),
    [pricingTiers]
  );

  const upsellInfo = useMemo(() => {
    if (sortedTiers.length < 2 || totalQty === 0) return null;

    let currentTierIdx = 0;
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      if (totalQty >= sortedTiers[i].minQuantity) {
        currentTierIdx = i;
        break;
      }
    }

    const nextTierIdx = currentTierIdx + 1;
    if (nextTierIdx >= sortedTiers.length) return null;

    const nextTier = sortedTiers[nextTierIdx];
    const remaining = nextTier.minQuantity - totalQty;
    const progress = totalQty / nextTier.minQuantity;

    if (progress < 0.6) return null;

    const nextUnitPrice = calculateTieredPrice(nextTier.minQuantity, pricingTiers, product.price).unitPrice;
    const savingsPerUnit = unitPrice - nextUnitPrice;
    const totalSavings = savingsPerUnit * nextTier.minQuantity;

    return {
      remaining,
      nextTierMinQty: nextTier.minQuantity,
      nextUnitPrice,
      totalSavings,
      progress,
    };
  }, [pricingTiers, product.price, sortedTiers, totalQty, unitPrice]);

  const activeTierIdx = useMemo(() => {
    if (sortedTiers.length === 0) return -1;
    let idx = 0;
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      if (totalQty >= sortedTiers[i].minQuantity) {
        idx = i;
        break;
      }
    }
    return totalQty > 0 ? idx : -1;
  }, [sortedTiers, totalQty]);

  const updateQty = useCallback((key: string, qty: number) => {
    setVariantQtys((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[key];
      } else {
        next[key] = qty;
      }
      return next;
    });
  }, []);

  const addUpsellQty = useCallback(() => {
    if (!upsellInfo) return;
    const firstActiveKey = Object.keys(variantQtys).find((key) => variantQtys[key] > 0);
    const targetKey = firstActiveKey || flattenedVariantRows[0]?.key;
    if (!targetKey) return;

    setVariantQtys((prev) => ({
      ...prev,
      [targetKey]: (prev[targetKey] || 0) + upsellInfo.remaining,
    }));
  }, [flattenedVariantRows, upsellInfo, variantQtys]);

  const getSelectedItems = useCallback((): SelectedItem[] => {
    return Object.entries(variantQtys)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const [colorName, kind, a, b] = key.split("|||");
        const colorObj = colors.find((color) => (color.name || color.hex) === colorName);
        const resolvedColorName = colorObj?.name || colorObj?.hex || "Standard";

        if (kind === "size") {
          return {
            colorHex: colorObj?.hex || null,
            colorName: resolvedColorName,
            size: a || null,
            quantity: qty,
          };
        }

        if (kind === "dynamic") {
          const variant = dynamicVariants.find((item) => item.typeId === a);
          const option = variant?.options.find((item) => item.id === b);
          return {
            colorHex: colorObj?.hex || null,
            colorName: resolvedColorName,
            size: variant && option ? `${variant.typeName}: ${option.label}` : null,
            quantity: qty,
          };
        }

        return {
          colorHex: colorObj?.hex || null,
          colorName: resolvedColorName,
          size: null,
          quantity: qty,
        };
      });
  }, [colors, dynamicVariants, variantQtys]);

  const handleAddToCart = useCallback(async () => {
    const items = getSelectedItems();

    if (items.length === 0) {
      toast({ title: "Sélectionnez au moins une variante", variant: "destructive" });
      return;
    }

    if (totalQty < moq) {
      toast({
        title: "Quantité insuffisante",
        description: `Minimum ${moq} pièce${moq > 1 ? "s" : ""} requise${moq > 1 ? "s" : ""}.`,
        variant: "destructive",
      });
      return;
    }

    for (const item of items) {
      await addItem({
        productId: product.id,
        name: product.name,
        nameFr: product.nameFr,
        image: product.image,
        price: unitPrice,
        originalPrice: product.originalPrice,
        color: item.colorHex,
        size: item.size,
        quantity: item.quantity,
        moq,
      });
    }

    onOpenChange(false);
  }, [addItem, getSelectedItems, moq, onOpenChange, product, toast, totalQty, unitPrice]);

  const handleOrderNow = useCallback(async () => {
    await handleAddToCart();
    navigate("/checkout");
  }, [handleAddToCart, navigate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`p-0 flex flex-col ${isMobile ? "h-[92vh] max-h-[92dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]" : "w-[560px] max-w-[90vw]"} [&>button.absolute]:hidden`}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-foreground">Sélectionnez les options et la quantité</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium px-3 py-1.5">
            <TrendingUp size={12} />
            Prix inférieur aux produits similaires
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {sortedTiers.length > 1 && (
            <div className="px-5 py-4">
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {sortedTiers.map((tier, index) => {
                  const tierUnitPrice = calculateTieredPrice(tier.minQuantity, pricingTiers, product.price).unitPrice;
                  const isActive = index === activeTierIdx;
                  const maxQty = index < sortedTiers.length - 1 ? sortedTiers[index + 1].minQuantity - 1 : null;

                  return (
                    <div
                      key={tier.id}
                      className={`shrink-0 min-w-[110px] px-3 py-2.5 rounded-lg border-2 text-center transition-all ${isActive ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/30"}`}
                    >
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        {maxQty ? `${tier.minQuantity} - ${maxQty}` : `≥ ${tier.minQuantity}`} pcs
                      </p>
                      <p className={`mt-0.5 text-base font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
                        ${tierUnitPrice.toFixed(2)}
                      </p>
                      {isActive && (
                        <div className="flex items-center justify-center gap-0.5 mt-1">
                          <Check size={10} className="text-primary" />
                          <span className="text-[10px] font-semibold text-primary">Actif</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {upsellInfo && (
            <div className="mx-5 mb-4 p-3 rounded-lg border border-accent bg-accent/30">
              <div className="flex items-start gap-2">
                <Target size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Vous êtes proche d'un meilleur prix</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ajoutez <span className="font-bold text-foreground">{upsellInfo.remaining}</span> pièce{upsellInfo.remaining > 1 ? "s" : ""} de plus pour débloquer{" "}
                    <span className="font-bold text-primary">${upsellInfo.nextUnitPrice.toFixed(2)}</span> / unité
                  </p>
                  {upsellInfo.totalSavings > 0 && (
                    <p className="mt-1 text-xs font-semibold text-primary">
                      Vous économisez ${upsellInfo.totalSavings.toFixed(2)}
                    </p>
                  )}

                  <div className="mt-2 mb-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(upsellInfo.progress * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">{totalQty} pcs</span>
                      <span className="text-[10px] text-muted-foreground">{upsellInfo.nextTierMinQty} pcs</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7 text-xs font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={addUpsellQty}
                  >
                    <Plus size={12} className="mr-1" />
                    Ajouter {upsellInfo.remaining} pièce{upsellInfo.remaining > 1 ? "s" : ""}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mx-5 border-t border-border" />

          <div className="px-5 py-4">
            {colors.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Couleur : <span className="normal-case text-foreground">{colors[selectedColorIdx]?.name || `Couleur ${selectedColorIdx + 1}`}</span>
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {colors.map((color, index) => (
                    <button
                      key={`${color.hex}-${index}`}
                      onClick={() => setSelectedColorIdx(index)}
                      className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${selectedColorIdx === index ? "border-primary ring-2 ring-primary/20 scale-105" : "border-border hover:border-primary/40"}`}
                      aria-label={color.name || `Couleur ${index + 1}`}
                    >
                      {color.imageUrl ? (
                        <img src={color.imageUrl} alt={color.name} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: color.hex }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {variantSections.map((section) => (
                <div key={section.id} className="space-y-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </p>
                  {section.rows.map((row) => (
                    <div
                      key={row.key}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${row.quantity > 0 ? "bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {row.displayLabel ? (
                          <span className="min-w-[40px] text-sm font-medium text-foreground">{row.displayLabel}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Quantité</span>
                        )}
                        <span className="text-sm text-muted-foreground">${unitPrice.toFixed(2)}</span>
                      </div>
                      <MiniQty value={row.quantity} onChange={(value) => updateQty(row.key, value)} min={0} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mx-5 border-t border-border" />

          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Truck size={16} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Livraison</span>
            </div>
            <PrecisionShippingEstimate
              productWeightGrams={product.weightGrams}
              productLengthCm={product.lengthCm}
              productWidthCm={product.widthCm}
              productHeightCm={product.heightCm}
              originCountry={product.originCountry}
              quantity={Math.max(totalQty, 1)}
              prepDaysMin={product.prepDaysMin}
              prepDaysMax={product.prepDaysMax}
            />
          </div>

          <div className="h-44" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 border-t bg-background border-border shadow-lg">
          <button
            onClick={() => setSubtotalExpanded(!subtotalExpanded)}
            className="flex items-center justify-between w-full px-5 py-3 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Sous-total</span>
              <span className="text-sm font-bold text-foreground">({totalQty} pcs)</span>
              {subtotalExpanded ? (
                <ChevronDown size={14} className="text-muted-foreground" />
              ) : (
                <ChevronUp size={14} className="text-muted-foreground" />
              )}
            </div>
            <span className="text-lg font-bold text-foreground">${subtotalAmount.toFixed(2)}</span>
          </button>

          {subtotalExpanded && totalQty > 0 && (
            <div className="px-5 pb-2 overflow-y-auto max-h-32 border-t border-border/50">
              {getSelectedItems().map((item, index) => (
                <div key={`${item.colorName}-${item.size}-${index}`} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-muted-foreground">
                    {item.colorName}{item.size ? ` / ${item.size}` : ""} × {item.quantity}
                  </span>
                  <span className="font-medium text-foreground">${(unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {tieredResult && tieredResult.savings > 0 && (
                <div className="flex items-center justify-between py-1.5 text-xs border-t border-border/50">
                  <span className="font-medium text-primary">Économie palier</span>
                  <span className="font-semibold text-primary">-${tieredResult.savings.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2">
            <Button
              variant="outline"
              className="h-11 gap-2 text-sm font-bold"
              onClick={handleAddToCart}
              disabled={totalQty === 0}
            >
              <ShoppingCart size={16} />
              Ajouter au panier
            </Button>
            <Button
              className="h-11 gap-2 text-sm font-bold"
              onClick={handleOrderNow}
              disabled={totalQty === 0}
            >
              <Zap size={16} />
              Commander
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
