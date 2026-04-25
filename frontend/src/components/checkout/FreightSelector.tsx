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
import { Loader2, Truck, ChevronDown, ChevronUp, BadgeCheck, AlertTriangle, Package, Boxes, MapPin, Plane, Ship, TramFront, Info, Sparkles, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  fetchEligibleFreightOffers,
  type EligibleFreightOffer,
  type QuoteCheckoutInput,
} from "@/services/freightQuoteCheckout";
import { useRoles } from "@/hooks/use-roles";

const MODE_META: Record<string, { label: string; Icon: typeof Plane; cls: string }> = {
  air: { label: "Aérien", Icon: Plane, cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  sea: { label: "Maritime", Icon: Ship, cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  road: { label: "Routier", Icon: Truck, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  rail: { label: "Ferroviaire", Icon: TramFront, cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  express: { label: "Express", Icon: Plane, cls: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30" },
};

export type ConsolidationChoice = "split" | "consolidated";

interface Props {
  destinationCountry: string;
  destinationCityId?: string | null;
  mode: string;
  items: QuoteCheckoutInput["items"];
  totalCbm?: number;
  totalWeightKg?: number;
  onChange: (offer: EligibleFreightOffer | null, choice?: ConsolidationChoice) => void;
  /** Notifie le parent du nombre d'offres éligibles (pour gating "choix obligatoire"). */
  onAvailabilityChange?: (count: number) => void;
  /** Nom de la ville (pour message d'état vide explicite). */
  destinationCityName?: string | null;
  /** Lot Very Speed — Tarif réel basé sur le poids/CBM (ancien moteur),
   *  affiché à titre indicatif marketing sur la carte du transitaire plateforme.
   *  Reste 0 ou undefined si non calculé. */
  realPriceIndicative?: number;
  /** Lot Very Speed — Poids total panier en kg (pour message "X pièces de plus"). */
  totalWeightKgForMarketing?: number;
}

export function FreightSelector({
  destinationCountry,
  destinationCityId,
  mode,
  items,
  totalCbm,
  totalWeightKg,
  onChange,
  onAvailabilityChange,
  destinationCityName,
  realPriceIndicative,
  totalWeightKgForMarketing,
}: Props) {
  const [offers, setOffers] = useState<EligibleFreightOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [consolidationChoice, setConsolidationChoice] = useState<ConsolidationChoice>("split");
  const { isAdmin } = useRoles();
  const [debugOpen, setDebugOpen] = useState(false);

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
        // Lot 4G — Diagnostic : pourquoi pas/peu d'offres ?
        // eslint-disable-next-line no-console
        console.info("[FreightSelector] eligible offers", {
          destinationCountry,
          destinationCityId,
          mode,
          totalCbm,
          totalWeightKg,
          count: res.length,
          offers: res.map((o) => ({
            profile_id: o.profile_id,
            mode: o.mode,
            service_class: o.service_class,
            total: o.quote.total,
            currency: o.quote.currency,
          })),
        });
        setOffers(res);
        // Lot Very Speed — On exclut les offres "plateforme grisées" (non sélectionnables)
        // du compteur de disponibilité utilisé pour le gating obligatoire.
        const selectableCount = res.filter(
          (o) => o.has_profile_for_zone !== false,
        ).length;
        onAvailabilityChange?.(selectableCount);
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

  // Lot Very Speed — Tri d'affichage :
  //  1) Les offres réellement sélectionnables (has_profile_for_zone !== false)
  //     en premier, par prix forfaitaire facturé croissant.
  //  2) Les cartes "plateforme grisée" en bas (informationnelles).
  //  Le badge "le moins cher" se base sur ce tri (sélectionnables uniquement).
  const sortedOffers = useMemo(() => {
    const selectable = offers
      .filter((o) => o.has_profile_for_zone !== false)
      .sort((a, b) => a.quote.total - b.quote.total);
    const greyed = offers.filter((o) => o.has_profile_for_zone === false);
    return [...selectable, ...greyed];
  }, [offers]);
  const cheapestSelectableId = useMemo(() => {
    const first = sortedOffers.find((o) => o.has_profile_for_zone !== false);
    return first?.profile_id ?? null;
  }, [sortedOffers]);
  const alternatives = useMemo(() => sortedOffers.slice(1), [sortedOffers]);
  const selectedOffer = useMemo(
    () => sortedOffers.find((o) => o.profile_id === selectedId) ?? null,
    [sortedOffers, selectedId],
  );

  const handleSelect = (offer: EligibleFreightOffer) => {
    // Lot Very Speed — Carte plateforme grisée : non sélectionnable.
    if (offer.has_profile_for_zone === false) return;
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
    // Lot 4G — Empty-state explicite : informe le client qu'aucun transitaire
    // ne couvre cette destination/mode et que le tarif standard sera appliqué.
    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-md border border-border bg-muted/40 text-[11px] text-muted-foreground">
          <Info size={12} className="shrink-0 mt-0.5 text-primary" />
          <span>
            Aucun transitaire ne dessert encore
            {destinationCityName ? ` ${destinationCityName}` : " cette destination"}
            {" "}
            en mode <span className="font-medium">{MODE_META[mode]?.label ?? mode}</span>.
            Le tarif standard ci-dessus sera appliqué et un transitaire sera assigné après commande.
          </span>
        </div>
        {isAdmin && (
          <AdminDebugBanner
            destinationCountry={destinationCountry}
            destinationCityId={destinationCityId}
            destinationCityName={destinationCityName}
            mode={mode}
            totalCbm={totalCbm}
            totalWeightKg={totalWeightKg}
            offersCount={0}
            offers={[]}
            open={debugOpen}
            onToggle={() => setDebugOpen((v) => !v)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Truck size={14} className="text-primary" />
          {selectedId ? "Transitaire choisi" : "Choisissez un transitaire"}
        </p>
        {!selectedId && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive uppercase tracking-wide">
            Requis
          </span>
        )}
      </div>

      <div className="grid gap-1.5">
        {(expanded ? sortedOffers : sortedOffers.slice(0, 1)).map((offer) => (
          <OfferCard
            key={offer.profile_id}
            offer={offer}
            isSelected={selectedId === offer.profile_id}
            isCheapest={offer.profile_id === cheapestSelectableId && sortedOffers.filter(o => o.has_profile_for_zone !== false).length > 1}
            onSelect={() => handleSelect(offer)}
            realPriceIndicative={realPriceIndicative}
            totalWeightKgForMarketing={totalWeightKgForMarketing}
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

      {isAdmin && (
        <AdminDebugBanner
          destinationCountry={destinationCountry}
          destinationCityId={destinationCityId}
          destinationCityName={destinationCityName}
          mode={mode}
          totalCbm={totalCbm}
          totalWeightKg={totalWeightKg}
          offersCount={offers.length}
          offers={offers}
          open={debugOpen}
          onToggle={() => setDebugOpen((v) => !v)}
        />
      )}
    </div>
  );
}

function AdminDebugBanner({
  destinationCountry,
  destinationCityId,
  destinationCityName,
  mode,
  totalCbm,
  totalWeightKg,
  offersCount,
  offers,
  open,
  onToggle,
}: {
  destinationCountry: string;
  destinationCityId?: string | null;
  destinationCityName?: string | null;
  mode: string;
  totalCbm?: number;
  totalWeightKg?: number;
  offersCount: number;
  offers: EligibleFreightOffer[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 text-[10px]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-amber-700 dark:text-amber-400 font-mono"
      >
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={11} />
          DEBUG ADMIN — {offersCount} offre{offersCount > 1 ? "s" : ""} retournée{offersCount > 1 ? "s" : ""}
        </span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1 font-mono text-[10px] text-amber-800 dark:text-amber-300/90">
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="opacity-70">country_code</span><span>{destinationCountry || "∅"}</span>
            <span className="opacity-70">city_id</span><span className="truncate">{destinationCityId || "∅"}</span>
            <span className="opacity-70">city_name</span><span>{destinationCityName || "∅"}</span>
            <span className="opacity-70">mode</span><span>{mode || "∅"}</span>
            <span className="opacity-70">total_cbm</span><span>{totalCbm ?? "∅"}</span>
            <span className="opacity-70">total_kg</span><span>{totalWeightKg ?? "∅"}</span>
          </div>
          {offers.length > 0 && (
            <div className="pt-1 mt-1 border-t border-amber-500/30 space-y-0.5">
              <div className="opacity-70 mb-0.5">Profils retenus :</div>
              {offers.map((o) => (
                <div key={o.profile_id} className="truncate">
                  • {o.forwarder_name ?? o.forwarder_id.slice(0, 8)} / {o.mode} / {o.service_class} → {o.quote.currency} {o.quote.total.toFixed(2)}
                </div>
              ))}
            </div>
          )}
          {offers.length === 0 && (
            <div className="pt-1 mt-1 border-t border-amber-500/30 opacity-80">
              SQL : forwarder_pricing_profiles WHERE is_active=true AND country_code='{destinationCountry}' AND mode='{mode}' AND (city_id IS NULL OR city_id='{destinationCityId ?? "∅"}')
            </div>
          )}
        </div>
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
  realPriceIndicative,
  totalWeightKgForMarketing,
}: {
  offer: EligibleFreightOffer;
  isSelected: boolean;
  isCheapest?: boolean;
  onSelect: () => void;
  realPriceIndicative?: number;
  totalWeightKgForMarketing?: number;
}) {
  const { quote, service_class, mode, pickup_address } = offer;
  const isPlatform = offer.is_platform_owned === true;
  const isPlatformGreyed = isPlatform && offer.has_profile_for_zone === false;
  const forwarderName = offer.forwarder_name ?? null;
  const meta = MODE_META[mode] ?? { label: mode, Icon: Truck, cls: "bg-muted text-foreground border-border" };
  const ModeIcon = meta.Icon;
  const transitLabel =
    quote.transit_min_days || quote.transit_max_days
      ? `${quote.transit_min_days ?? "?"}–${quote.transit_max_days ?? "?"} jours`
      : null;

  // ───────────────── Cas 1 : Carte plateforme grisée (Very Speed indispo) ───
  if (isPlatformGreyed) {
    return (
      <div
        className="w-full flex items-start gap-2 px-2.5 py-2 rounded-md border border-dashed border-border bg-muted/30 text-left opacity-70 cursor-not-allowed"
        aria-disabled="true"
      >
        {offer.forwarder_logo_url ? (
          <img
            src={offer.forwarder_logo_url}
            alt={forwarderName ?? "Plateforme"}
            className="h-7 w-7 rounded object-cover bg-muted shrink-0 grayscale"
            loading="lazy"
          />
        ) : (
          <div className="h-7 w-7 rounded bg-muted flex items-center justify-center shrink-0">
            <Sparkles size={13} className="text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              {forwarderName ?? "Service plateforme"}
            </span>
            <span className="text-[9px] px-1.5 py-0 rounded-full border border-border bg-background text-muted-foreground uppercase tracking-wide">
              Plateforme
            </span>
            <Lock size={10} className="text-muted-foreground" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {offer.unavailable_message ?? "Service plateforme non disponible dans votre zone"}
          </p>
        </div>
      </div>
    );
  }

  // ───────── Cas 2 : Carte plateforme active (tarif réel marketing + forfait) ─
  if (isPlatform && realPriceIndicative && realPriceIndicative > 0) {
    const flatPrice = quote.total;
    const showRealVsFlat = realPriceIndicative < flatPrice; // typiquement sous le seuil 1 kg
    const weightKg = totalWeightKgForMarketing ?? 0;
    const remainingForOneKg = weightKg > 0 && weightKg < 1 ? 1 - weightKg : 0;
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-md border-2 text-left transition-all ${
          isSelected
            ? "border-primary bg-primary/10"
            : "border-primary/40 bg-primary/5 hover:border-primary"
        }`}
      >
        {offer.forwarder_logo_url ? (
          <img
            src={offer.forwarder_logo_url}
            alt={forwarderName ?? "Plateforme"}
            className="h-7 w-7 rounded object-cover bg-background shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="h-7 w-7 rounded bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles size={13} className="text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              {forwarderName ?? "Service plateforme"}
            </span>
            <span className="text-[9px] px-1.5 py-0 rounded-full bg-primary/15 text-primary uppercase tracking-wide font-semibold">
              Plateforme
            </span>
            {isCheapest && (
              <span className="text-[9px] px-1.5 py-0 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                Le moins cher
              </span>
            )}
            {isSelected && <BadgeCheck size={11} className="text-primary" />}
            {pickup_address && (
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      aria-label="Adresse de récupération"
                    >
                      <MapPin size={9} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm text-[11px] break-words">
                    <p className="font-semibold mb-0.5">Adresse de récupération</p>
                    <p className="whitespace-pre-line break-words text-muted-foreground">{pickup_address}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {showRealVsFlat ? (
            <div className="mt-1 space-y-0.5">
              {/* Ligne 1 : tarif réel ↔ montant entre parenthèses (même taille) */}
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] text-muted-foreground">
                  Tarif réel basé sur votre poids ({weightKg.toFixed(2)} kg)
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                  ({quote.currency} {realPriceIndicative.toFixed(2)})
                </p>
              </div>
              {/* Ligne 2 : forfait facturé ↔ montant en gras (aligné) */}
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-snug">
                  ℹ️ Le transitaire vous facturera le forfait minimum de
                </p>
                <p className="text-xs font-bold text-foreground whitespace-nowrap">
                  {quote.currency} {flatPrice.toFixed(2)}
                </p>
              </div>
              {transitLabel && (
                <p className="text-[10px] text-muted-foreground">Délai : {transitLabel}</p>
              )}
              {remainingForOneKg > 0 && (
                <p className="text-[10px] text-primary leading-snug">
                  💡 Ajoutez encore {(remainingForOneKg * 1000).toFixed(0)}g pour atteindre 1 kg
                  et rentabiliser ce tarif.
                </p>
              )}
            </div>
          ) : (
            <>
              {transitLabel && (
                <p className="text-[10px] text-muted-foreground">Délai : {transitLabel}</p>
              )}
              <div className="mt-0.5 flex justify-end">
                <p className="text-xs font-bold text-foreground">
                  {quote.currency} {flatPrice.toFixed(2)}
                </p>
              </div>
            </>
          )}
        </div>
      </button>
    );
  }

  // ───────────────── Cas 3 : Carte transitaire partenaire standard ──────────
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
      {offer.forwarder_logo_url ? (
        <img
          src={offer.forwarder_logo_url}
          alt={forwarderName ?? meta.label}
          className="h-7 w-7 rounded object-cover bg-muted shrink-0"
          loading="lazy"
        />
      ) : (
        <div className={`h-7 w-7 rounded border flex items-center justify-center shrink-0 ${meta.cls}`}>
          <ModeIcon size={13} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {forwarderName && (
            <span className="text-xs font-semibold text-foreground truncate">{forwarderName}</span>
          )}
          <span className={`text-[9px] px-1.5 py-0 rounded-full border uppercase tracking-wide font-semibold ${meta.cls}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-muted-foreground capitalize">{service_class}</span>
          {isCheapest && (
            <span className="text-[9px] px-1.5 py-0 rounded-full bg-primary/15 text-primary uppercase tracking-wide">
              Le moins cher
            </span>
          )}
          {isSelected && <BadgeCheck size={11} className="text-primary" />}
          {pickup_address && (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    aria-label="Adresse de récupération"
                  >
                    <MapPin size={9} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm text-[11px] break-words">
                  <p className="font-semibold mb-0.5">Adresse de récupération</p>
                  <p className="whitespace-pre-line break-words text-muted-foreground">{pickup_address}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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