import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Calculator, TrendingUp, Info, BookmarkCheck } from "lucide-react";
import {
  calculateSalePrice,
  calculateOldPrice,
  getMaxExtraMargin,
  calculateMarginPercent,
  resolveMultiplier,
  DEFAULT_TIERS,
  DEFAULT_PRICING,
  type PricingDefaults,
  type PricingTier,
} from "@/lib/pricing-utils";
import { supabase } from "@/integrations/supabase/client";

interface PricingCalculatorProps {
  costReal: number;
  costCalc: number;
  autoPricingEnabled: boolean;
  vendorExtraMargin: number;
  price: number;
  originalPrice: number | null;
  storeId: string;
  categoryId?: string | null;
  onCostRealChange: (v: number) => void;
  onCostCalcChange: (v: number) => void;
  onAutoPricingChange: (v: boolean) => void;
  onVendorExtraMarginChange: (v: number) => void;
  onPriceChange: (v: number) => void;
  onOriginalPriceChange: (v: number | null) => void;
}

export function PricingCalculator({
  costReal, costCalc, autoPricingEnabled, vendorExtraMargin,
  price, originalPrice, storeId, categoryId,
  onCostRealChange, onCostCalcChange, onAutoPricingChange,
  onVendorExtraMarginChange, onPriceChange, onOriginalPriceChange,
}: PricingCalculatorProps) {
  const [settings, setSettings] = useState<PricingDefaults>(DEFAULT_PRICING);
  const [overrides, setOverrides] = useState<{
    max_multiplier?: number;
    max_extra_margin?: number;
    vendor_extra_margin_enabled?: boolean;
    margin_pct?: number;
    multiplier?: number;
  } | null>(null);
  const [isPlatformOwned, setIsPlatformOwned] = useState<boolean>(false);
  const [categoryOverride, setCategoryOverride] = useState<{
    margin_pct: number | null;
    multiplier: number | null;
    tiers: PricingTier[] | null;
    description: string | null;
  } | null>(null);

  useEffect(() => {
    // Load global pricing settings
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "pricing_defaults")
      .single()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as any;
          setSettings({
            margin_pct: Number(v.margin_pct) || 15,
            multiplier: Number(v.multiplier) || 3,
            max_extra_margin_under_50: Number(v.max_extra_margin_under_50) || 0.50,
            max_extra_margin_over_100: Number(v.max_extra_margin_over_100) || 1.00,
            transaction_fee_pct: Number(v.transaction_fee_pct) || 5,
            tiers: Array.isArray(v.tiers) && v.tiers.length > 0 ? v.tiers : DEFAULT_TIERS,
          });
        }
      });

    // Load vendor-specific overrides
    (supabase as any)
      .from("vendor_pricing_overrides")
      .select("max_multiplier, max_extra_margin, vendor_extra_margin_enabled, margin_pct, multiplier")
      .eq("store_id", storeId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setOverrides(data);
      });

    // Load store's platform-owned flag
    (supabase as any)
      .from("stores")
      .select("is_platform_owned")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setIsPlatformOwned(!!data.is_platform_owned);
      });
  }, [storeId]);

  // Load category-level pricing override (if any)
  useEffect(() => {
    if (!categoryId) { setCategoryOverride(null); return; }
    (supabase as any)
      .from("category_pricing_overrides")
      .select("margin_pct, multiplier, tiers, description, active")
      .eq("category_id", categoryId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data && data.active) {
          setCategoryOverride({
            margin_pct: data.margin_pct,
            multiplier: data.multiplier,
            tiers: Array.isArray(data.tiers) ? data.tiers : null,
            description: data.description,
          });
        } else {
          setCategoryOverride(null);
        }
      });
  }, [categoryId]);

  // Per-store overrides take priority, then global defaults
  const effectiveMarginPct =
    overrides?.margin_pct ?? categoryOverride?.margin_pct ?? settings.margin_pct;

  // Multiplier resolution priority: vendor override → category override (fixed) → tiers (category > global) → fallback
  const effectiveTiers: PricingTier[] | null =
    categoryOverride?.tiers && categoryOverride.tiers.length > 0
      ? categoryOverride.tiers
      : (settings.tiers && settings.tiers.length > 0 ? settings.tiers : DEFAULT_TIERS);

  const effectiveMultiplier = resolveMultiplier(costCalc, {
    forcedMultiplier: overrides?.multiplier ?? categoryOverride?.multiplier ?? null,
    tiers: effectiveTiers,
    defaultMultiplier: settings.multiplier,
  });
  const effectiveTransactionFee = settings.transaction_fee_pct;
  const vendorExtraMarginAllowed = overrides?.vendor_extra_margin_enabled ?? false;

  // Recalculate when inputs change
  const recalculate = useCallback(() => {
    if (!autoPricingEnabled || costCalc <= 0) return;
    const extraMargin = vendorExtraMarginAllowed ? vendorExtraMargin : 0;
    const sp = calculateSalePrice(costCalc, effectiveMarginPct, effectiveMultiplier, extraMargin, effectiveTransactionFee);
    const op = calculateOldPrice(sp);
    onPriceChange(sp);
    onOriginalPriceChange(op);
  }, [costCalc, effectiveMarginPct, effectiveMultiplier, effectiveTransactionFee, vendorExtraMargin, vendorExtraMarginAllowed, autoPricingEnabled, onPriceChange, onOriginalPriceChange]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  const maxExtra = getMaxExtraMargin(price, settings);

  // Auto-clamp vendor extra margin when price changes cause the max to decrease
  useEffect(() => {
    const currentMax = overrides?.max_extra_margin != null
      ? Math.min(maxExtra, overrides.max_extra_margin)
      : maxExtra;
    if (vendorExtraMarginAllowed && vendorExtraMargin > currentMax) {
      onVendorExtraMarginChange(currentMax);
    }
  }, [maxExtra, overrides?.max_extra_margin, vendorExtraMargin, vendorExtraMarginAllowed, onVendorExtraMarginChange]);
  const effectiveMaxExtra = overrides?.max_extra_margin != null
    ? Math.min(maxExtra, overrides.max_extra_margin)
    : maxExtra;

  const marginPct = calculateMarginPercent(costReal, price);
  const effectiveCost = costCalc > 0 ? costCalc + (costCalc * effectiveTransactionFee / 100) : 0;

  const inputClass = "w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20";

  // Build a short human-readable summary of the active tiers (e.g. "×3 si <$10 … ×1.3 si ≥$200")
  const tiersSummary = (() => {
    if (!effectiveTiers || effectiveTiers.length === 0) return null;
    const sorted = [...effectiveTiers].sort((a, b) => {
      if (a.max_cost == null) return 1;
      if (b.max_cost == null) return -1;
      return a.max_cost - b.max_cost;
    });
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstLabel = first.max_cost != null ? `×${first.multiplier} si <$${first.max_cost}` : `×${first.multiplier}`;
    const lastLabel = last.max_cost == null ? `×${last.multiplier} si ≥$${sorted[sorted.length - 2]?.max_cost ?? 0}` : `×${last.multiplier}`;
    return `${firstLabel} … ${lastLabel}`;
  })();

  return (
    <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Tarification intelligente</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Calcul auto</span>
          <Switch checked={autoPricingEnabled} onCheckedChange={onAutoPricingChange} />
        </div>
      </div>

      {autoPricingEnabled && (
        <>
          {isPlatformOwned && (
            <div className="text-[11px] bg-primary/5 border border-primary/20 rounded-md p-2 flex items-start gap-1.5 text-foreground/80">
              <Info size={12} className="text-primary mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Tarification plateforme :</strong> marge {effectiveMarginPct}% × multiplicateur dégressif{tiersSummary ? ` (${tiersSummary})` : ""}.
                {categoryOverride?.description && (
                  <> Catégorie : <em>{categoryOverride.description}</em>.</>
                )}
                {" "}Le prix final reflète automatiquement cette logique.
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
                <span>Coût d'achat réel ($)</span>
                {costReal > 0 && (
                  <span
                    title="Ce montant est mémorisé et reste visible à chaque réouverture du produit pour comparer la marge réelle."
                    className="inline-flex items-center gap-0.5 text-[9px] px-1 py-[1px] rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    <BookmarkCheck size={9} /> Mémorisé
                  </span>
                )}
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={costReal || ""}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  onCostRealChange(v);
                  if (costCalc <= 0 && v > 0) onCostCalcChange(v);
                }}
                className={inputClass}
                placeholder="Ex: 3.50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Achat + transport fournisseur — référence conservée pour calculer une remise.
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Coût d'achat calcul ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={costCalc || ""}
                onChange={(e) => onCostCalcChange(Number(e.target.value) || 0)}
                className={inputClass}
                placeholder="Ex: 4.00"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Base de calcul (≥ réel)</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Frais transaction (%)</label>
              <input type="number" value={effectiveTransactionFee} readOnly className={inputClass + " bg-muted/50 cursor-not-allowed"} />
              <p className="text-[10px] text-muted-foreground mt-1">Alibaba, etc.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Marge (%)</label>
              <input type="number" value={effectiveMarginPct} readOnly className={inputClass + " bg-muted/50 cursor-not-allowed"} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Multiplicateur</label>
              <input type="number" value={effectiveMultiplier} readOnly className={inputClass + " bg-muted/50 cursor-not-allowed"} />
            </div>
          </div>

          {/* Vendor extra margin — only if admin enabled it for this store */}
          {vendorExtraMarginAllowed && effectiveMaxExtra > 0 && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Marge vendeur (+${effectiveMaxExtra.toFixed(2)} max)
              </label>
              <input
                type="number"
                min={0}
                max={effectiveMaxExtra}
                step={0.01}
                value={vendorExtraMargin || ""}
                onChange={(e) => {
                  const v = Math.min(Number(e.target.value) || 0, effectiveMaxExtra);
                  onVendorExtraMarginChange(v);
                }}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          )}

          {/* Preview */}
          {costCalc > 0 && (
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Aperçu des prix</span>
              </div>
              {/* Effective cost display */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                <span>Coût calcul: ${costCalc.toFixed(2)}</span>
                <span>+</span>
                <span>Frais {effectiveTransactionFee}%: ${(costCalc * effectiveTransactionFee / 100).toFixed(2)}</span>
                <span>=</span>
                <span className="font-semibold text-foreground">Coût effectif: ${effectiveCost.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">Prix de vente</p>
                  <p className="text-lg font-bold text-primary">${price.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Ancien prix</p>
                  <p className="text-lg font-bold text-muted-foreground line-through">${(originalPrice || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Marge brute</p>
                  <p className={`text-lg font-bold ${marginPct >= 50 ? "text-green-600" : marginPct >= 30 ? "text-yellow-600" : "text-destructive"}`}>
                    {marginPct}%
                  </p>
                </div>
              </div>
              {costReal > 0 && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Info size={10} /> Profit estimé par unité : ${(price - costReal).toFixed(2)}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!autoPricingEnabled && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info size={12} /> Mode manuel : saisissez le prix et l'ancien prix directement ci-dessous.
        </p>
      )}
    </div>
  );
}
