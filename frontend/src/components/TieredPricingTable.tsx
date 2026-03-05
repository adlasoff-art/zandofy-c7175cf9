import { useMemo } from "react";
import { Check } from "lucide-react";

export interface PricingTier {
  id: string;
  tierLabel: string;
  minQuantity: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
}

interface TieredPricingTableProps {
  tiers: PricingTier[];
  basePrice: number;
  currentQuantity: number;
  currency?: string;
}

function getTierPrice(basePrice: number, tier: PricingTier): number {
  if (tier.discountType === "percentage") {
    return basePrice * (1 - tier.discountValue / 100);
  }
  return Math.max(0, basePrice - tier.discountValue);
}

export function calculateTieredPrice(
  qty: number,
  tiers: PricingTier[],
  basePrice: number
): { unitPrice: number; tier: PricingTier; savings: number } {
  const sorted = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity);
  const matched = sorted.find((t) => qty >= t.minQuantity) || sorted[sorted.length - 1];
  const unitPrice = getTierPrice(basePrice, matched);
  const savings = (basePrice - unitPrice) * qty;
  return { unitPrice, tier: matched, savings };
}

export function TieredPricingTable({
  tiers,
  basePrice,
  currentQuantity,
  currency = "$",
}: TieredPricingTableProps) {
  const sorted = useMemo(
    () => [...tiers].sort((a, b) => a.minQuantity - b.minQuantity),
    [tiers]
  );

  const activeTierIndex = useMemo(() => {
    let idx = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (currentQuantity >= sorted[i].minQuantity) {
        idx = i;
        break;
      }
    }
    return idx;
  }, [sorted, currentQuantity]);

  if (sorted.length <= 1) return null;

  return (
    <div className="border border-border rounded-sm overflow-hidden">
      <div className="bg-muted/50 px-3 py-2">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Prix dégressifs par volume
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table" aria-label="Tableau des prix par volume">
          <thead>
            <tr className="bg-muted/30">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Quantité</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Prix unitaire</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Réduction</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground sr-only md:not-sr-only">Actif</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((tier, i) => {
              const unitPrice = getTierPrice(basePrice, tier);
              const isActive = i === activeTierIndex;
              const isNextTier = i === activeTierIndex + 1;
              return (
                <tr
                  key={tier.id}
                  className={`border-t border-border/50 transition-colors ${
                    isActive
                      ? "bg-primary/5 font-medium"
                      : isNextTier
                      ? "bg-accent/5"
                      : ""
                  }`}
                >
                  <td className="px-3 py-2 text-foreground">
                    {i < sorted.length - 1
                      ? `${tier.minQuantity}–${sorted[i + 1].minQuantity - 1}`
                      : `${tier.minQuantity}+`}
                    <span className="text-xs text-muted-foreground ml-1">pcs</span>
                  </td>
                  <td className="px-3 py-2 text-foreground font-medium">
                    {currency}{unitPrice.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    {tier.discountValue > 0 ? (
                      <span className="text-sm font-semibold text-sale">
                        -{tier.discountType === "percentage" ? `${tier.discountValue}%` : `${currency}${tier.discountValue}`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                        <Check size={14} /> Actif
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
