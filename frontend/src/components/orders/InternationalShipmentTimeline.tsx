import { useEffect, useState } from "react";
import { Loader2, Factory, Plane, FileCheck2, PackageCheck, XCircle, Check, Hash, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InternationalShipmentTimeline — Lot 4K
 *
 * Read-only customer-facing timeline for international orders:
 *   Origine (Chine) → En transit → Douane → Livré
 *
 * Steps are derived from the latest forwarder_handoff status for the order.
 *   pending / notified  → step 1 (Origine)
 *   acknowledged        → step 2 (Pris en charge)
 *   in_transit          → step 3 (En transit / Douane)
 *   delivered           → step 4 (Livré)
 *   cancelled           → état spécial
 */

type HandoffStatus =
  | "pending"
  | "notified"
  | "acknowledged"
  | "in_transit"
  | "delivered"
  | "cancelled";

interface HandoffRow {
  status: HandoffStatus;
  notified_at: string | null;
  acknowledged_at: string | null;
  updated_at: string;
  created_at: string;
  tracking_number: string | null;
  tracking_carrier: string | null;
  tracking_url: string | null;
}

interface Step {
  key: string;
  label: string;
  sublabel: string;
  icon: JSX.Element;
}

const STEPS: Step[] = [
  {
    key: "origin",
    label: "Origine",
    sublabel: "Préparation à l'expédition",
    icon: <Factory size={14} />,
  },
  {
    key: "handoff",
    label: "Pris en charge",
    sublabel: "Réceptionné par le transitaire",
    icon: <Check size={14} />,
  },
  {
    key: "transit",
    label: "En transit / Douane",
    sublabel: "Acheminement international",
    icon: <Plane size={14} />,
  },
  {
    key: "delivered",
    label: "Livré",
    sublabel: "Disponible pour la livraison locale",
    icon: <PackageCheck size={14} />,
  },
];

function statusToIndex(status: HandoffStatus | null): number {
  switch (status) {
    case "pending":
    case "notified":
      return 0;
    case "acknowledged":
      return 1;
    case "in_transit":
      return 2;
    case "delivered":
      return 3;
    default:
      return 0;
  }
}

export function InternationalShipmentTimeline({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(true);
  const [handoff, setHandoff] = useState<HandoffRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("forwarder_handoffs")
        .select("status, notified_at, acknowledged_at, updated_at, created_at, tracking_number, tracking_carrier, tracking_url")
        .eq("order_id", orderId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setHandoff((data as HandoffRow) ?? null);
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
        Chargement du suivi international…
      </div>
    );
  }

  if (!handoff) return null;

  if (handoff.status === "cancelled") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-xs text-destructive">
        <XCircle size={14} /> Expédition annulée par le transitaire.
      </div>
    );
  }

  const currentIdx = statusToIndex(handoff.status);
  const hasTracking = !!handoff.tracking_number;

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <FileCheck2 size={11} /> Suivi international
        </p>
        <p className="text-[10px] text-muted-foreground">
          Mis à jour : {new Date(handoff.updated_at).toLocaleDateString("fr-FR")}
        </p>
      </div>

      <ol className="relative grid grid-cols-4 gap-1">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;
          return (
            <li key={step.key} className="flex flex-col items-center text-center relative">
              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute top-3.5 left-1/2 w-full h-0.5 ${
                    idx < currentIdx ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <span
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isDone
                    ? "bg-primary text-primary-foreground border-primary"
                    : isCurrent
                      ? "bg-primary/10 text-primary border-primary animate-pulse"
                      : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {isDone ? <Check size={12} /> : step.icon}
              </span>
              <p
                className={`mt-1.5 text-[10px] font-semibold leading-tight ${
                  isFuture ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {step.label}
              </p>
              <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 max-w-[90px]">
                {step.sublabel}
              </p>
            </li>
          );
        })}
      </ol>

      {hasTracking && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Hash size={12} className="text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {handoff.tracking_carrier || "N° de suivi"}
              </p>
              <p className="text-xs font-mono font-semibold text-foreground truncate">
                {handoff.tracking_number}
              </p>
            </div>
          </div>
          {handoff.tracking_url && (
            <a
              href={handoff.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              Suivre <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}