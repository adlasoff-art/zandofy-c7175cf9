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
import { Loader2, Truck, ChevronDown, ChevronUp, BadgeCheck, AlertTriangle, Package, Boxes } from "lucide-react";
import {
  fetchEligibleFreightOffers,
  type EligibleFreightOffer,
  type QuoteCheckoutInput,
} from "@/services/freightQuoteCheckout";

export type ConsolidationChoice = "split" | "consolidated";

interface Props {
  destinationCountry: string;
  destinationCityId?: string | null;
  mode: string;
  items: QuoteCheckoutInput["items"];
  totalCbm?: number;
  totalWeightKg?: number;
  onChange: (offer: EligibleFreightOffer | null, choice?: ConsolidationChoice) => void;
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
  const [consolidationChoice, setConsolidationChoice] = useState<ConsolidationChoice>("split");

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
        // Lot 4G — Pas de pré-sélection : le client doit choisir activement.
        setSelectedId(null);
        setConsolidationChoice("split");
        onChange(null, "split");
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
  const selectedOffer = useMemo(
    () => offers.find((o) => o.profile_id === selectedId) ?? null,
    [offers, selectedId],
  );

  const handleSelect = (offer: EligibleFreightOffer) => {
    setSelectedId(offer.profile_id);
    setConsolidationChoice("split");
    onChange(offer, "split");
  };

  const handleConsolidationChange = (choice: ConsolidationChoice) => {
    setConsolidationChoice(choice);
    if (selectedOffer) onChange(selectedOffer, choice);
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
          <Truck size={11} className="text-primary" />
          {selectedId ? "Transitaire choisi" : "Choisissez un transitaire"}
        </div>
        {!selectedId && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive uppercase tracking-wide">
            Requis
          </span>
        )}
      </div>

      <div className="grid gap-1.5">
        {(expanded ? offers : offers.slice(0, 1)).map((offer, idx) => (
          <OfferCard
            key={offer.profile_id}
            offer={offer}
            isSelected={selectedId === offer.profile_id}
            isCheapest={idx === 0 && offers.length > 1}
            onSelect={() => handleSelect(offer)}
          />
        ))}
      </div>

      {alternatives.length > 0 && (
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
      )}

      {selectedOffer?.consolidation_offer?.available && (
        <ConsolidationChooser
          offer={selectedOffer}
          choice={consolidationChoice}
          onChange={handleConsolidationChange}
        />
      )}
    </div>
  );
}

function ConsolidationChooser({
  offer,
  choice,
  onChange,
}: {
  offer: EligibleFreightOffer;
  choice: ConsolidationChoice;
  onChange: (c: ConsolidationChoice) => void;
}) {
  const co = offer.consolidation_offer;
  if (!co?.available) return null;
  const splitTotal = offer.split_total ?? offer.quote.total;
  const delta = co.delta_vs_split;
  const deltaLabel =
    delta === 0
      ? "même prix"
      : delta > 0
        ? `+${delta.toFixed(2)} ${offer.quote.currency}`
        : `−${Math.abs(delta).toFixed(2)} ${offer.quote.currency}`;

  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-2">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Mode d'expédition
      </div>
      <button
        type="button"
        onClick={() => onChange("split")}
        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left transition-colors ${
          choice === "split"
            ? "bg-primary/10 border border-primary"
            : "bg-background border border-border hover:border-primary/50"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Package size={11} className="text-muted-foreground shrink-0" />
          <span className="text-[11px] font-medium">Expédition séparée</span>
          <span className="text-[9px] text-muted-foreground">
            {offer.subpackages?.length ?? 0} colis
          </span>
        </div>
        <span className="text-[11px] font-semibold">
          {offer.quote.currency} {splitTotal.toFixed(2)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("consolidated")}
        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left transition-colors ${
          choice === "consolidated"
            ? "bg-primary/10 border border-primary"
            : "bg-background border border-border hover:border-primary/50"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Boxes size={11} className="text-muted-foreground shrink-0" />
          <span className="text-[11px] font-medium">Groupage 1 colis</span>
          <span className="text-[9px] text-muted-foreground">{deltaLabel}</span>
        </div>
        <span className="text-[11px] font-semibold">
          {offer.quote.currency} {co.consolidated_total.toFixed(2)}
        </span>
      </button>
      {co.consolidation_fee > 0 && (
        <p className="text-[9px] text-muted-foreground px-1">
          Frais de groupage inclus : {offer.quote.currency} {co.consolidation_fee.toFixed(2)}
        </p>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  isSelected,
  isCheapest,
  onSelect,
}: {
  offer: EligibleFreightOffer;
  isSelected: boolean;
  isCheapest?: boolean;
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
          {isCheapest && (
            <span className="text-[9px] px-1.5 py-0 rounded-full bg-primary/15 text-primary uppercase tracking-wide">
              Le moins cher
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