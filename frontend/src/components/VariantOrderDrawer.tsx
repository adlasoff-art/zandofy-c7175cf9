import { useState, useMemo, useCallback, useEffect } from "react";
import { X, ChevronDown, ChevronUp, ShoppingCart, Zap, TrendingUp, Truck, Target, Plus, Minus, Check } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculateTieredPrice, type PricingTier } from "@/components/TieredPricingTable";
import { PrecisionShippingEstimate } from "@/components/PrecisionShippingEstimate";
import { useNavigate } from "react-router-dom";
import type { Product } from "@/services/api";

// ── Types ──
interface ColorOption {
  hex: string;
  name: string;
  imageUrl?: string | null;
}

interface SizeOption {
  label: string;
  region?: string;
}

interface VariantRow {
  key: string; // e.g. "Red-M"
  colorIndex: number;
  sizeLabel: string;
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
}

// ── Mini Quantity Input ──
function MiniQty({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="inline-flex items-center border border-border rounded-sm overflow-hidden h-8">
      <button
        type="button"
        className="w-7 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
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
          if (!isNaN(v)) onChange(Math.max(min, v));
        }}
        className="w-10 h-8 text-center text-xs font-medium bg-background text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={min}
        aria-label="Quantité"
      />
      <button
        type="button"
        className="w-7 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        onClick={() => onChange(value + 1)}
        aria-label="Augmenter"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

// ── Main Component ──
export function VariantOrderDrawer({
  open,
  onOpenChange,
  product,
  colors,
  sizes,
  pricingTiers,
  moq,
}: VariantOrderDrawerProps) {
  const isMobile = useIsMobile();
  const { addItem } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── State ──
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [variantQtys, setVariantQtys] = useState<Record<string, number>>({});
  const [subtotalExpanded, setSubtotalExpanded] = useState(false);

  // Reset when drawer opens
  useEffect(() => {
    if (open) {
      setVariantQtys({});
      setSelectedColorIdx(0);
      setSubtotalExpanded(false);
    }
  }, [open]);

  // ── Build variant rows for current color ──
  const currentColorName = colors[selectedColorIdx]?.name || colors[selectedColorIdx]?.hex || "default";

  const variantRows: VariantRow[] = useMemo(() => {
    if (sizes.length === 0) {
      // No sizes, just one row per color
      return [{
        key: currentColorName,
        colorIndex: selectedColorIdx,
        sizeLabel: "",
        quantity: variantQtys[currentColorName] || 0,
      }];
    }
    return sizes.map((s) => {
      const key = `${currentColorName}-${s.label}`;
      return {
        key,
        colorIndex: selectedColorIdx,
        sizeLabel: s.label,
        quantity: variantQtys[key] || 0,
      };
    });
  }, [sizes, currentColorName, selectedColorIdx, variantQtys]);

  // ── Total quantity across ALL colors/sizes ──
  const totalQty = useMemo(
    () => Object.values(variantQtys).reduce((s, q) => s + q, 0),
    [variantQtys]
  );

  // ── Tier pricing calculation ──
  const tieredResult = useMemo(() => {
    if (pricingTiers.length === 0) return null;
    const qty = Math.max(totalQty, 1);
    return calculateTieredPrice(qty, pricingTiers, product.price);
  }, [totalQty, pricingTiers, product.price]);

  const unitPrice = tieredResult?.unitPrice ?? product.price;
  const subtotalAmount = unitPrice * totalQty;

  // ── Sorted tiers for display ──
  const sortedTiers = useMemo(
    () => [...pricingTiers].sort((a, b) => a.minQuantity - b.minQuantity),
    [pricingTiers]
  );

  // ── Smart MOQ Upsell logic ──
  const upsellInfo = useMemo(() => {
    if (sortedTiers.length < 2 || totalQty === 0) return null;

    // Find the current tier index
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

    // Only show when close (within 40% of next tier)
    if (progress < 0.6) return null;

    const nextUnitPrice = pricingTiers.length > 0
      ? calculateTieredPrice(nextTier.minQuantity, pricingTiers, product.price).unitPrice
      : product.price;

    const currentTotal = unitPrice * totalQty;
    const nextTotal = nextUnitPrice * nextTier.minQuantity;
    const savingsPerUnit = unitPrice - nextUnitPrice;
    const totalSavings = savingsPerUnit * nextTier.minQuantity;

    return {
      remaining,
      nextTierMinQty: nextTier.minQuantity,
      nextUnitPrice,
      savingsPerUnit,
      totalSavings,
      progress,
      tierLabel: nextTier.tierLabel,
    };
  }, [sortedTiers, totalQty, unitPrice, pricingTiers, product.price]);

  // ── Handlers ──
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
    // Distribute remaining qty to the first variant row that has qty > 0, or the first row
    const firstActiveKey = Object.keys(variantQtys).find((k) => variantQtys[k] > 0);
    const targetKey = firstActiveKey || variantRows[0]?.key;
    if (!targetKey) return;
    setVariantQtys((prev) => ({
      ...prev,
      [targetKey]: (prev[targetKey] || 0) + upsellInfo.remaining,
    }));
  }, [upsellInfo, variantQtys, variantRows]);

  // ── Get all selected items for cart ──
  const getSelectedItems = useCallback(() => {
    return Object.entries(variantQtys)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const parts = key.split("-");
        const colorName = sizes.length > 0 ? parts.slice(0, -1).join("-") : key;
        const size = sizes.length > 0 ? parts[parts.length - 1] : null;
        const colorObj = colors.find((c) => (c.name || c.hex) === colorName);
        return {
          colorHex: colorObj?.hex || null,
          colorName,
          size,
          quantity: qty,
        };
      });
  }, [variantQtys, sizes, colors]);

  const handleAddToCart = useCallback(async () => {
    const items = getSelectedItems();
    if (items.length === 0) {
      toast({ title: "Sélectionnez au moins une variante", variant: "destructive" });
      return;
    }
    if (totalQty < moq) {
      toast({ title: "Quantité insuffisante", description: `Minimum ${moq} pièce${moq > 1 ? "s" : ""} requise${moq > 1 ? "s" : ""}.`, variant: "destructive" });
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
  }, [getSelectedItems, totalQty, moq, addItem, product, unitPrice, onOpenChange, toast]);

  const handleOrderNow = useCallback(async () => {
    await handleAddToCart();
    navigate("/checkout");
  }, [handleAddToCart, navigate]);

  // ── Active tier index for visual indicator ──
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

  // ── Render ──
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`p-0 flex flex-col ${
          isMobile
            ? "h-[92vh] rounded-t-2xl"
            : "w-[560px] max-w-[90vw]"
        } [&>button.absolute]:hidden`}
      >
        {/* ── HEADER ── */}
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-foreground">Sélectionnez les options et la quantité</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-primary/8 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
            <TrendingUp size={12} />
            Prix inférieur aux produits similaires
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ═══ SECTION 1: Tier Pricing ═══ */}
          {sortedTiers.length > 1 && (
            <div className="px-5 py-4">
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {sortedTiers.map((tier, i) => {
                  const tierUnitPrice = calculateTieredPrice(tier.minQuantity, pricingTiers, product.price).unitPrice;
                  const isActive = i === activeTierIdx;
                  const maxQty = i < sortedTiers.length - 1 ? sortedTiers[i + 1].minQuantity - 1 : null;

                  return (
                    <div
                      key={tier.id}
                      className={`shrink-0 min-w-[110px] px-3 py-2.5 rounded-lg border-2 text-center transition-all cursor-default ${
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/30"
                      }`}
                    >
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {maxQty ? `${tier.minQuantity} - ${maxQty}` : `≥ ${tier.minQuantity}`} pcs
                      </p>
                      <p className={`text-base font-bold mt-0.5 ${isActive ? "text-primary" : "text-foreground"}`}>
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

          {/* ═══ SMART MOQ UPSELL ═══ */}
          {upsellInfo && (
            <div className="mx-5 mb-4 p-3 bg-accent/30 border border-accent rounded-lg">
              <div className="flex items-start gap-2">
                <Target size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Vous êtes proche d'un meilleur prix
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ajoutez <span className="font-bold text-foreground">{upsellInfo.remaining}</span> pièce{upsellInfo.remaining > 1 ? "s" : ""} de plus pour débloquer{" "}
                    <span className="font-bold text-primary">${upsellInfo.nextUnitPrice.toFixed(2)}</span> / unité
                  </p>
                  {upsellInfo.totalSavings > 0 && (
                    <p className="text-xs font-semibold text-primary mt-1">
                      Vous économisez ${upsellInfo.totalSavings.toFixed(2)}
                    </p>
                  )}

                  {/* Progress bar */}
                  <div className="mt-2 mb-1.5">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
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

          {/* ── Separator ── */}
          <div className="border-t border-border mx-5" />

          {/* ═══ SECTION 2: Product Variants ═══ */}
          <div className="px-5 py-4">
            {/* Color Selection */}
            {colors.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Couleur : <span className="text-foreground normal-case">{colors[selectedColorIdx]?.name || `Couleur ${selectedColorIdx + 1}`}</span>
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {colors.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedColorIdx(i)}
                      className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${
                        selectedColorIdx === i
                          ? "border-primary ring-2 ring-primary/20 scale-105"
                          : "border-border hover:border-primary/40"
                      }`}
                      aria-label={color.name || `Couleur ${i + 1}`}
                    >
                      {color.imageUrl ? (
                        <img src={color.imageUrl} alt={color.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: color.hex }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Variant Table */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {sizes.length > 0 ? "Tailles & Quantités" : "Quantité"}
              </p>
              {variantRows.map((row) => (
                <div
                  key={row.key}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                    row.quantity > 0 ? "bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {row.sizeLabel && (
                      <span className="text-sm font-medium text-foreground min-w-[40px]">
                        {row.sizeLabel}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">${unitPrice.toFixed(2)}</span>
                  </div>
                  <MiniQty
                    value={row.quantity}
                    onChange={(v) => updateQty(row.key, v)}
                    min={0}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Separator ── */}
          <div className="border-t border-border mx-5" />

          {/* ═══ SECTION 3: Shipping ═══ */}
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
            />
          </div>

          {/* Bottom padding for sticky footer */}
          <div className="h-44" />
        </div>

        {/* ═══ STICKY SUBTOTAL & ACTIONS ═══ */}
        <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-10">
          {/* Subtotal toggle */}
          <button
            onClick={() => setSubtotalExpanded(!subtotalExpanded)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Sous-total</span>
              <span className="text-sm font-bold text-foreground">
                ({totalQty} pcs)
              </span>
              {subtotalExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
            </div>
            <span className="text-lg font-bold text-foreground">${subtotalAmount.toFixed(2)}</span>
          </button>

          {/* Expanded details */}
          {subtotalExpanded && totalQty > 0 && (
            <div className="px-5 pb-2 max-h-32 overflow-y-auto border-t border-border/50">
              {getSelectedItems().map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-muted-foreground">
                    {item.colorName}{item.size ? ` / ${item.size}` : ""} × {item.quantity}
                  </span>
                  <span className="font-medium text-foreground">
                    ${(unitPrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {tieredResult && tieredResult.savings > 0 && (
                <div className="flex items-center justify-between py-1.5 text-xs border-t border-border/50">
                  <span className="text-primary font-medium">Économie palier</span>
                  <span className="font-semibold text-primary">
                    -${tieredResult.savings.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11 text-sm font-bold gap-2"
              onClick={handleAddToCart}
              disabled={totalQty === 0}
            >
              <ShoppingCart size={16} />
              Ajouter au panier
            </Button>
            <Button
              className="h-11 text-sm font-bold gap-2"
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
