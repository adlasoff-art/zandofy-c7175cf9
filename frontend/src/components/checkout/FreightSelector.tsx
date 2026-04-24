/**
 * FreightSelector.tsx — Lot 4C
 *
 * Sélecteur hybride de transitaire basé sur le moteur Lot 3A (CBM/pièce/poids
 * volumétrique avec acompte conditionnel).
 *
 * Comportement :
 *  - Recommandation par défaut = profil le moins cher
 *  - Bouton "Voir alternatives" → liste comparative (prix, transit, restrictions)
 *  - Si aucun profil éligible → affiche null (le parent doit fallback sur l'ancien
 *    ForwarderSelector legacy ou sur le tarif standard)
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Truck, ChevronDown, ChevronUp, BadgeCheck, AlertTriangle } from "lucide-react";
import {
  fetchEligibleFreightOffers,
  type EligibleFreightOffer,
  type QuoteCheckoutInput,
} from "@/services/freightQuoteCheckout";

interface Props {
  destinationCountry: string;
  destinationCityId?: string | null;
  mode: string;
  items: QuoteCheckoutInput["items"];
  totalCbm?: number;
  totalWeightKg?: number;
  onChange: (offer: EligibleFreightOffer | null) => void;
}

export function FreightSelector({
  destinationCountry,
  destinationCityId,
  mode,
  items,
  totalCbm,
  totalWeightKg,
  onChange,
}: Props) {
  const [offers, setOffers] = useState<EligibleFreightOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Refetch on context change
  useEffect(() => {
    if (!destinationCountry || !mode || items.length === 0) {
      setOffers([]);
      onChange(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchEligibleFreightOffers({
      destinationCountry,
      destinationCityId,
      mode,
      items,
      totalCbm,
      totalWeightKg,
    })
      .then((res) => {
        if (cancelled) return;
        setOffers(res);
        const recommended = res[0] ?? null;
        setSelectedId(recommended?.profile_id ?? null);
        onChange(recommended);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationCountry, destinationCityId, mode, totalCbm, totalWeightKg, items.length]);

  const recommended = useMemo(() => offers[0] ?? null, [offers]);
  const alternatives = useMemo(() => offers.slice(1), [offers]);

  const handleSelect = (offer: EligibleFreightOffer) => {
    setSelectedId(offer.profile_id);
    onChange(offer);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin text-primary" />
        Calcul des devis transporteurs…
      </div>
    );
  }

  if (offers.length === 0) {
    // Pas de profil — laisser le parent fallback
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
        <Truck size={11} className="text-primary" />
        Transitaire recommandé
      </div>

      {recommended && (
        <OfferCard
          offer={recommended}
          isSelected={selectedId === recommended.profile_id}
          isRecommended
          onSelect={() => handleSelect(recommended)}
        />
      )}

      {alternatives.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded
              ? "Masquer les alternatives"
              : `Voir ${alternatives.length} alternative${alternatives.length > 1 ? "s" : ""}`}
          </button>

          {expanded && (
            <div className="grid gap-1.5 pt-1">
              {alternatives.map((offer) => (
                <OfferCard
                  key={offer.profile_id}
                  offer={offer}
                  isSelected={selectedId === offer.profile_id}
                  onSelect={() => handleSelect(offer)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  isSelected,
  isRecommended,
  onSelect,
}: {
  offer: EligibleFreightOffer;
  isSelected: boolean;
  isRecommended?: boolean;
  onSelect: () => void;
}) {
  const { quote, service_class } = offer;
  const transitLabel =
    quote.transit_min_days || quote.transit_max_days
      ? `${quote.transit_min_days ?? "?"}–${quote.transit_max_days ?? "?"} jours`
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-md border text-left transition-all ${
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:border-primary/50"
      }`}
    >
      <div className="h-7 w-7 rounded bg-muted flex items-center justify-center shrink-0">
        <Truck size={12} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-foreground capitalize">{service_class}</span>
          {isRecommended && (
            <span className="text-[9px] px-1.5 py-0 rounded-full bg-primary/15 text-primary uppercase tracking-wide">
              Recommandé
            </span>
          )}
          {isSelected && <BadgeCheck size={11} className="text-primary" />}
        </div>
        {transitLabel && (
          <p className="text-[10px] text-muted-foreground">Délai : {transitLabel}</p>
        )}
        {quote.warnings.length > 0 && (
          <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
            <AlertTriangle size={9} />
            {quote.warnings[0]}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-bold text-foreground">
          {quote.currency} {quote.total.toFixed(2)}
        </p>
        {quote.deposit_required && (
          <p className="text-[9px] text-muted-foreground">
            Acompte {quote.deposit_pct}% : {quote.deposit_amount.toFixed(2)}
          </p>
        )}
      </div>
    </button>
  );
}