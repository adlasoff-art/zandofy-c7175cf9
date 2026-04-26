/**
 * OperatorSelector — Lot 11B Phase B4
 *
 * Affiche la liste des opérateurs de livraison disponibles pour la ville/commune
 * du client et permet d'en choisir un. S'intègre dans CheckoutPage uniquement
 * lorsque deliveryOption === "home_delivery".
 */
import { Loader2, Truck, Star, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOperatorQuotes, type OperatorQuote } from "@/hooks/useOperatorQuotes";

interface Props {
  city: string | null | undefined;
  countryCode: string | null | undefined;
  commune?: string | null;
  quartier?: string | null;
  selectedOperatorId: string | null;
  onSelect: (quote: OperatorQuote | null) => void;
}

export function OperatorSelector({
  city,
  countryCode,
  commune,
  quartier,
  selectedOperatorId,
  onSelect,
}: Props) {
  const { data: quotes, isLoading } = useOperatorQuotes({
    city,
    countryCode,
    commune,
    quartier,
    enabled: !!city && !!countryCode,
  });

  if (!city || !countryCode) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3 bg-muted/30 rounded-lg">
        <Loader2 size={14} className="animate-spin text-muted-foreground mr-2" />
        <span className="text-xs text-muted-foreground">
          Recherche des transporteurs disponibles...
        </span>
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
        Aucun transporteur partenaire dans cette zone — la livraison sera
        assurée par notre flotte interne.
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <Truck size={12} className="text-primary" /> Choisissez votre transporteur
      </p>
      <div className="space-y-1.5">
        {quotes.map((q) => {
          const isSelected = selectedOperatorId === q.operator_id;
          return (
            <button
              key={q.operator_id}
              type="button"
              onClick={() => onSelect(isSelected ? null : q)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                isSelected
                  ? "border-primary bg-secondary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isSelected ? "border-primary" : "border-border"
                }`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              {q.logo_url ? (
                <img
                  src={q.logo_url}
                  alt={q.company_name}
                  className="w-8 h-8 rounded object-cover bg-muted shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  <Truck size={14} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">
                    {q.company_name}
                  </p>
                  {q.is_platform_owned && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/30"
                    >
                      <ShieldCheck size={8} className="mr-0.5" /> Officiel
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  {q.rating_avg !== null && q.total_deliveries > 0 && (
                    <span className="flex items-center gap-0.5 text-foreground">
                      <Star size={9} className="fill-current" />
                      {Number(q.rating_avg).toFixed(1)} ({q.total_deliveries})
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} /> {q.estimated_minutes} min
                  </span>
                  {!q.matched && (
                    <span className="italic">tarif indicatif</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground">
                  ${q.fee.toFixed(2)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}