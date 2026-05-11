/**
 * FreightSummary.tsx — Lot 4C
 *
 * Récapitulatif détaillé du devis fret sélectionné :
 *  - Prix total + devise
 *  - Acompte (si applicable au seuil CBM)
 *  - Transit min/max
 *  - Restrictions (badges)
 *  - Détail des lignes (CBM + pièces)
 */

import { Clock, AlertTriangle, Package, BadgeDollarSign, Info } from "lucide-react";
import type { EligibleFreightOffer } from "@/services/freightQuoteCheckout";
import { useI18n } from "@/contexts/I18nContext";

interface Restriction {
  label: string;
  restriction_type: string;
  icon?: string | null;
}

interface Props {
  offer: EligibleFreightOffer;
  restrictions?: Restriction[];
}

export function FreightSummary({ offer, restrictions }: Props) {
  const { t } = useI18n();
  const { quote } = offer;
  const transitLabel =
    quote.transit_min_days || quote.transit_max_days
      ? (t("freight.transitDays", { min: quote.transit_min_days ?? "?", max: quote.transit_max_days ?? "?" }) ||
          `${quote.transit_min_days ?? "?"}–${quote.transit_max_days ?? "?"} jours`)
      : (t("freight.delayUnknown") || "Délai non communiqué");

  return (
    <div className="rounded-lg border border-border bg-background/50 p-3 space-y-3">
      {/* Header prix */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("freight.totalTransportCost") || "Frais de transport"}</p>
          <p className="text-base font-bold text-foreground">
            {quote.currency} {quote.total.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("freight.chargeableSummary", { cbm: quote.total_cbm.toFixed(3), kg: quote.total_chargeable_weight_kg.toFixed(1) }) ||
              `${quote.total_cbm.toFixed(3)} CBM · ${quote.total_chargeable_weight_kg.toFixed(1)} kg facturable`}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
            <Clock size={10} />
            <span>{transitLabel}</span>
          </div>
        </div>
      </div>

      {/* Acompte conditionnel */}
      {quote.deposit_required && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-md border border-primary/30 bg-primary/5 text-[11px]">
          <BadgeDollarSign size={12} className="shrink-0 mt-0.5 text-primary" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {t("freight.depositRequired", { amount: `${quote.currency} ${quote.deposit_amount.toFixed(2)}` }) ||
                `Acompte requis : ${quote.currency} ${quote.deposit_amount.toFixed(2)}`}
              <span className="text-muted-foreground font-normal">
                {" "}
                {t("freight.depositOfFreight", { pct: quote.deposit_pct }) || `(${quote.deposit_pct}% du fret)`}
              </span>
            </p>
            <p className="text-muted-foreground text-[10px]">
              {t("freight.balanceLater", { amount: `${quote.currency} ${(quote.total - quote.deposit_amount).toFixed(2)}` }) ||
                `Le solde de ${quote.currency} ${(quote.total - quote.deposit_amount).toFixed(2)} sera réglé à la livraison ou avant expédition selon le transitaire.`}
            </p>
          </div>
        </div>
      )}

      {/* Restrictions */}
      {restrictions && restrictions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("freight.restrictions") || "Restrictions"}</p>
          <div className="flex flex-wrap gap-1">
            {restrictions.map((r, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground border border-border"
              >
                <Info size={9} />
                {r.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Warnings du calcul */}
      {quote.warnings.length > 0 && (
        <div className="space-y-1">
          {quote.warnings.map((w, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-[10px] text-destructive"
            >
              <AlertTriangle size={10} className="shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Détail des lignes */}
      {quote.lines.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[10px] text-primary hover:underline list-none flex items-center gap-1">
            <Package size={10} />
            <span className="group-open:hidden">{t("freight.seeCalcDetails") || "Voir le détail du calcul"}</span>
            <span className="hidden group-open:inline">{t("freight.hideCalcDetails") || "Masquer le détail"}</span>
          </summary>
          <ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">
            {quote.lines.map((line, idx) => (
              <li key={idx} className="flex justify-between gap-2 border-t border-border/50 pt-1">
                <span className="flex-1">{line.label}</span>
                <span className="font-medium text-foreground shrink-0">
                  {line.quote_only ? "—" : `${quote.currency} ${line.line_total.toFixed(2)}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}