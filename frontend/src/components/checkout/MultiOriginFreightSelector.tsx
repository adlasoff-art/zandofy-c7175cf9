/**
 * MultiOriginFreightSelector.tsx — Lot 11C Phase 2
 *
 * Affiche un FreightSelector par groupe (store_id × origin_country) du panier.
 * Chaque groupe = 1 sous-commande logique → 1 transitaire indépendant à choisir.
 *
 * Le total `shipping_cost` agrégé = somme des devis sélectionnés.
 * Tant qu'au moins un groupe n'a pas de transitaire choisi, le parent doit
 * empêcher la confirmation (via `onSelectionChange` qui remonte le mapping).
 */

import { useEffect, useMemo, useState } from "react";
import { Package, MapPin, MailPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FreightSelector, type ConsolidationChoice } from "./FreightSelector";
import type { CartOriginGroup } from "@/services/freightQuoteCheckout";
import type { EligibleFreightOffer } from "@/services/freightQuoteCheckout";
import { getCountryName } from "@/components/vendor/CountryCombobox";

export interface FreightGroupSelection {
  group: CartOriginGroup;
  offer: EligibleFreightOffer | null;
  choice: ConsolidationChoice;
}

interface Props {
  groups: CartOriginGroup[];
  destinationCountry: string;
  destinationCityId: string | null;
  destinationCityName: string | null;
  /** Mode actif global (air/sea/road/rail) — appliqué à tous les groupes compatibles. */
  mode: string;
  /** Callback : reçoit le mapping complet { groupKey → selection } à chaque changement. */
  onSelectionChange: (selections: Record<string, FreightGroupSelection>) => void;
  /** Callback : nombre total d'offres éligibles tous groupes confondus (pour gating UX). */
  onAvailabilityChange?: (totalCount: number, missingGroups: number) => void;
}

export function MultiOriginFreightSelector({
  groups,
  destinationCountry,
  destinationCityId,
  destinationCityName,
  mode,
  onSelectionChange,
  onAvailabilityChange,
}: Props) {
  // Sélection courante : groupKey → { offer, choice }
  const [selections, setSelections] = useState<Record<string, FreightGroupSelection>>({});
  // Disponibilité par groupe : groupKey → count
  const [availability, setAvailability] = useState<Record<string, number>>({});
  // Demandes de couverture en cours / déjà envoyées par groupe.
  const [coverageState, setCoverageState] = useState<Record<string, "idle" | "loading" | "sent">>({});

  // Reset quand la liste de groupes change (ex: panier modifié, mode changé).
  useEffect(() => {
    const initial: Record<string, FreightGroupSelection> = {};
    for (const g of groups) {
      initial[g.key] = { group: g, offer: null, choice: "split" };
    }
    setSelections(initial);
    setAvailability({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.map((g) => g.key).join(","), mode]);

  // Notifier le parent à chaque changement de sélection.
  useEffect(() => {
    onSelectionChange(selections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections]);

  // Notifier le parent du compteur global de disponibilité.
  useEffect(() => {
    const totalCount = Object.values(availability).reduce((s, n) => s + n, 0);
    const missingGroups = groups.filter((g) => (availability[g.key] ?? 0) === 0).length;
    onAvailabilityChange?.(totalCount, missingGroups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, groups.length]);

  const handleGroupChange = (groupKey: string, group: CartOriginGroup) =>
    (offer: EligibleFreightOffer | null, choice?: ConsolidationChoice) => {
      setSelections((prev) => ({
        ...prev,
        [groupKey]: { group, offer, choice: choice ?? "split" },
      }));
    };

  const handleGroupAvailability = (groupKey: string) => (count: number) => {
    setAvailability((prev) => (prev[groupKey] === count ? prev : { ...prev, [groupKey]: count }));
  };

  const requestCoverage = async (group: CartOriginGroup) => {
    if (!group.origin_country) {
      toast.error("Origine inconnue — impossible d'envoyer la demande.");
      return;
    }
    setCoverageState((prev) => ({ ...prev, [group.key]: "loading" }));
    try {
      const { data, error } = await supabase.functions.invoke("request-forwarder-coverage", {
        body: {
          origin_country: group.origin_country,
          destination_country: destinationCountry,
          destination_city: destinationCityName,
          destination_city_id: destinationCityId,
          mode,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        (data as any)?.deduplicated
          ? "Demande déjà enregistrée — un admin vous contactera dès qu'un transitaire couvre la route."
          : "Demande envoyée — un admin vous contactera dès qu'un transitaire couvre la route.",
      );
      setCoverageState((prev) => ({ ...prev, [group.key]: "sent" }));
    } catch (e: any) {
      toast.error(e?.message || "Impossible d'envoyer la demande");
      setCoverageState((prev) => ({ ...prev, [group.key]: "idle" }));
    }
  };

  // Total agrégé pour affichage récap.
  const aggregatedTotal = useMemo(() => {
    return Object.values(selections).reduce((s, sel) => {
      if (!sel.offer) return s;
      const co = sel.offer.consolidation_offer;
      const v =
        sel.choice === "consolidated" && co?.available
          ? co.consolidated_total
          : (sel.offer.split_total ?? sel.offer.quote.total);
      return s + (Number(v) || 0);
    }, 0);
  }, [selections]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 px-2.5 py-2 rounded-md border border-primary/30 bg-primary/5 text-[11px] text-foreground">
        <Package size={12} className="shrink-0 mt-0.5 text-primary" />
        <span>
          Votre panier sera expédié en <strong>{groups.length} colis distincts</strong>{" "}
          (selon l'origine et la boutique). Choisissez un transitaire pour chaque colis.
        </span>
      </div>

      {groups.map((group, idx) => {
        const sel = selections[group.key];
        const compatible = group.supported_modes.length === 0 || group.supported_modes.includes(mode as any);
        return (
          <div
            key={group.key}
            className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {String.fromCharCode(65 + idx)}
                </span>
                <MapPin size={12} className="text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">
                  Colis depuis {group.origin_country ? getCountryName(group.origin_country) : "Origine inconnue"}
                </span>
                {group.store_name && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    · {group.store_name}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {group.items.reduce((s, i) => s + i.quantity, 0)} article
                {group.items.reduce((s, i) => s + i.quantity, 0) > 1 ? "s" : ""}
              </span>
            </div>

            {!compatible ? (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/30">
                ⚠️ Le mode <strong>{mode}</strong> n'est pas compatible avec tous les produits de ce
                colis. Modes supportés : {group.supported_modes.join(", ") || "aucun"}.
              </div>
            ) : (
              <>
                <FreightSelector
                  destinationCountry={destinationCountry}
                  destinationCityId={destinationCityId}
                  destinationCityName={destinationCityName}
                  mode={mode}
                  originCountry={group.origin_country || null}
                  items={group.items}
                  totalCbm={group.total_cbm}
                  totalWeightKg={group.total_weight_kg}
                  onChange={handleGroupChange(group.key, group)}
                  onAvailabilityChange={handleGroupAvailability(group.key)}
                />
                {availability[group.key] === 0 && (
                  <div className="mt-2 flex items-start justify-between gap-2 px-2.5 py-2 rounded-md border border-amber-500/30 bg-amber-500/5">
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                      Aucun transitaire ne dessert encore{" "}
                      <strong>
                        {group.origin_country ? getCountryName(group.origin_country) : "cette origine"}
                      </strong>{" "}
                      → <strong>{getCountryName(destinationCountry)}</strong> en mode{" "}
                      <strong>{mode}</strong>.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 shrink-0"
                      disabled={coverageState[group.key] === "loading" || coverageState[group.key] === "sent"}
                      onClick={() => requestCoverage(group)}
                    >
                      {coverageState[group.key] === "loading" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <MailPlus size={12} />
                      )}
                      {coverageState[group.key] === "sent" ? "Envoyé" : "Demander couverture"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {aggregatedTotal > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-primary/10 border border-primary/30">
          <span className="text-xs font-medium text-foreground">
            Total transport ({Object.values(selections).filter((s) => s.offer).length}/{groups.length} colis)
          </span>
          <span className="text-sm font-bold text-primary">
            ${aggregatedTotal.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}