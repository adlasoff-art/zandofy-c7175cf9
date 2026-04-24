/**
 * FreightDetailsPanel.tsx — Lot 4H
 *
 * Affichage post-commande du devis de fret verrouillé :
 *  - Transitaire choisi (mode + service class)
 *  - Mode d'expédition retenu (split par sous-colis ou groupé multi-fournisseurs)
 *  - Détail par sous-colis (poids facturable, palier utilisé, total ligne)
 *  - Prix total verrouillé + acompte si requis + transit estimé
 *
 * Lecture seule. Charge automatiquement freight_quotes via le orders.freight_quote_id.
 * Affiche null si la commande n'a pas de devis fret (commande locale, etc.).
 */

import { useEffect, useState } from "react";
import { Truck, Package, Layers, BadgeDollarSign, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InternationalShipmentTimeline } from "./InternationalShipmentTimeline";

interface SubpackageRow {
  supplier_id: string;
  real_weight_kg: number;
  volumetric_weight_kg: number;
  billable_weight_kg: number;
  cbm: number;
  tier_used: string;
  line_total: number;
}

interface FreightQuoteRow {
  id: string;
  status: string;
  quoted_price: number;
  currency: string;
  deposit_amount: number;
  deposit_pct: number;
  requires_deposit: boolean;
  transit_min_days: number | null;
  transit_max_days: number | null;
  cbm: number;
  weight_kg: number;
  pieces_count: number;
  breakdown: {
    forwarder_id?: string;
    mode?: string;
    service_class?: string;
    consolidation_choice?: "split" | "consolidated";
    split_total?: number;
    consolidation_offer?: {
      consolidated_total: number;
      consolidation_fee: number;
      delta_vs_split: number;
    } | null;
    subpackages?: SubpackageRow[];
  } | null;
}

const MODE_LABELS: Record<string, string> = {
  air: "Aérien",
  sea: "Maritime",
  road: "Routier",
  rail: "Ferroviaire",
  express: "Express",
};

export function FreightDetailsPanel({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<FreightQuoteRow | null>(null);
  const [forwarderName, setForwarderName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      // 1) Récupérer freight_quote_id depuis la commande
      const { data: order } = await (supabase as any)
        .from("orders")
        .select("freight_quote_id")
        .eq("id", orderId)
        .maybeSingle();

      const quoteId = (order as any)?.freight_quote_id;
      if (!quoteId) {
        if (!cancelled) {
          setQuote(null);
          setLoading(false);
        }
        return;
      }

      // 2) Charger le devis verrouillé (RLS = owner)
      const { data: q } = await (supabase as any)
        .from("freight_quotes")
        .select(
          "id, status, quoted_price, currency, deposit_amount, deposit_pct, requires_deposit, transit_min_days, transit_max_days, cbm, weight_kg, pieces_count, breakdown",
        )
        .eq("id", quoteId)
        .maybeSingle();

      if (!q) {
        if (!cancelled) {
          setQuote(null);
          setLoading(false);
        }
        return;
      }

      // 3) Récupérer le nom du transitaire
      const fwId = (q as any).breakdown?.forwarder_id;
      let fwName: string | null = null;
      if (fwId) {
        const { data: fw } = await (supabase as any)
          .from("forwarders")
          .select("name")
          .eq("id", fwId)
          .maybeSingle();
        fwName = (fw as any)?.name ?? null;
      }

      if (!cancelled) {
        setQuote(q as FreightQuoteRow);
        setForwarderName(fwName);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 size={12} className="animate-spin text-primary" />
        Chargement du détail fret…
      </div>
    );
  }

  if (!quote) return null;

  const bd = quote.breakdown ?? {};
  const choice = bd.consolidation_choice ?? "split";
  const subpackages = bd.subpackages ?? [];
  const modeLabel = bd.mode ? MODE_LABELS[bd.mode] ?? bd.mode : "—";
  const transitLabel =
    quote.transit_min_days || quote.transit_max_days
      ? `${quote.transit_min_days ?? "?"}–${quote.transit_max_days ?? "?"} jours`
      : "Délai non communiqué";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Transport international
          </p>
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Truck size={13} className="text-primary" />
            {forwarderName ?? "Transitaire"}
            <span className="text-[10px] font-normal text-muted-foreground">
              · {modeLabel}
              {bd.service_class ? ` · ${bd.service_class}` : ""}
            </span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">
            {quote.currency} {Number(quote.quoted_price).toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
            <Clock size={9} /> {transitLabel}
          </p>
        </div>
      </div>

      {/* Mode split / groupé */}
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
            choice === "consolidated"
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-muted text-muted-foreground border border-border"
          }`}
        >
          {choice === "consolidated" ? <Layers size={10} /> : <Package size={10} />}
          {choice === "consolidated"
            ? "Groupage multi-fournisseurs"
            : `Expédition séparée (${subpackages.length || quote.pieces_count} colis)`}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {Number(quote.cbm).toFixed(3)} CBM · {Number(quote.weight_kg).toFixed(1)} kg
        </span>
      </div>

      {/* Acompte */}
      {quote.requires_deposit && (
        <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/5 text-[11px]">
          <BadgeDollarSign size={12} className="shrink-0 mt-0.5 text-primary" />
          <p className="text-foreground">
            Acompte fret : <strong>{quote.currency} {Number(quote.deposit_amount).toFixed(2)}</strong>
            <span className="text-muted-foreground"> ({quote.deposit_pct}%)</span>
          </p>
        </div>
      )}

      {/* Timeline internationale (Lot 4K) */}
      <InternationalShipmentTimeline orderId={orderId} />

      {/* Détail sous-colis */}
      {subpackages.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-primary hover:underline list-none flex items-center gap-1">
            <Package size={11} />
            <span className="group-open:hidden">
              Voir le détail par sous-colis ({subpackages.length})
            </span>
            <span className="hidden group-open:inline">Masquer le détail</span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {subpackages.map((sp, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-[10px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">
                    Colis #{idx + 1}
                    <span className="text-muted-foreground font-normal">
                      {" "}· {sp.tier_used}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {Number(sp.billable_weight_kg).toFixed(1)} kg facturable ·{" "}
                    {Number(sp.cbm).toFixed(3)} CBM
                  </p>
                </div>
                <span className="font-semibold text-foreground shrink-0">
                  {choice === "consolidated"
                    ? "—"
                    : `${quote.currency} ${Number(sp.line_total).toFixed(2)}`}
                </span>
              </li>
            ))}
          </ul>
          {choice === "consolidated" && bd.consolidation_offer && (
            <p className="mt-2 text-[10px] text-muted-foreground italic">
              Frais de groupage inclus :{" "}
              {quote.currency}{" "}
              {Number(bd.consolidation_offer.consolidation_fee).toFixed(2)} (économie vs split :{" "}
              {quote.currency}{" "}
              {Math.max(0, -Number(bd.consolidation_offer.delta_vs_split)).toFixed(2)})
            </p>
          )}
        </details>
      )}
    </div>
  );
}