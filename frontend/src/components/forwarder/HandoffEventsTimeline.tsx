import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  History,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  Hash,
  Wallet,
  StickyNote,
  Bell,
  Pencil,
} from "lucide-react";

/**
 * Lot 4Q — Timeline of all events recorded for a forwarder handoff.
 * Reads from `forwarder_handoff_events` (RLS-protected: customers see their own,
 * transporters see their linked handoffs, admins see all).
 *
 * Lazy-loaded: events are only fetched when the parent <details> is opened.
 */

interface HandoffEvent {
  id: string;
  event_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_role: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const EVENT_META: Record<
  string,
  { label: string; icon: typeof CheckCircle2; tone: "default" | "secondary" | "outline" | "destructive" }
> = {
  status_changed: { label: "Statut modifié", icon: CheckCircle2, tone: "default" },
  notified: { label: "Transitaire notifié", icon: Bell, tone: "secondary" },
  acknowledged: { label: "Pris en charge", icon: CheckCircle2, tone: "default" },
  in_transit: { label: "En transit", icon: Truck, tone: "default" },
  delivered: { label: "Livré", icon: PackageCheck, tone: "default" },
  cancelled: { label: "Annulé", icon: XCircle, tone: "destructive" },
  tracking_updated: { label: "Tracking mis à jour", icon: Hash, tone: "secondary" },
  notes_updated: { label: "Notes mises à jour", icon: StickyNote, tone: "outline" },
  deposit_paid: { label: "Acompte encaissé", icon: Wallet, tone: "default" },
  balance_paid: { label: "Solde encaissé", icon: Wallet, tone: "default" },
  field_updated: { label: "Champ modifié", icon: Pencil, tone: "outline" },
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  transporter: "Transitaire",
  customer: "Client",
  system: "Système",
};

function formatValue(field: string | null, value: string | null): string {
  if (value === null || value === "") return "—";
  if (field === "deposit_paid_amount" || field === "balance_paid_amount" || field === "deposit_amount") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : value;
  }
  return value;
}

interface Props {
  handoffId: string;
  /** When false, the component does not fetch (used inside lazy <details>). */
  enabled?: boolean;
}

export function HandoffEventsTimeline({ handoffId, enabled = true }: Props) {
  const [events, setEvents] = useState<HandoffEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || events !== null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("forwarder_handoff_events")
        .select("id, event_type, field_name, old_value, new_value, actor_role, metadata, created_at")
        .eq("handoff_id", handoffId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setEvents([]);
      } else {
        setEvents((data ?? []) as HandoffEvent[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, handoffId, events]);

  if (!enabled) return null;

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-muted-foreground text-xs">
        <Loader2 size={12} className="animate-spin" /> Chargement de l'historique…
      </div>
    );
  }
  if (error) {
    return <div className="mt-2 text-xs text-destructive">Erreur : {error}</div>;
  }
  if (!events || events.length === 0) {
    return <div className="mt-2 text-xs text-muted-foreground">Aucun événement enregistré.</div>;
  }

  return (
    <ol className="mt-2 space-y-2 border-l border-border pl-3">
      {events.map((ev) => {
        const meta = EVENT_META[ev.event_type] ?? {
          label: ev.event_type,
          icon: History,
          tone: "outline" as const,
        };
        const Icon = meta.icon;
        const date = new Date(ev.created_at);
        return (
          <li key={ev.id} className="relative">
            <span className="absolute -left-[17px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-background border border-border">
              <Icon size={9} className="text-muted-foreground" />
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={meta.tone} className="text-[10px]">
                {meta.label}
              </Badge>
              {ev.actor_role && (
                <span className="text-[10px] text-muted-foreground">
                  · {ROLE_LABEL[ev.actor_role] ?? ev.actor_role}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                · {date.toLocaleDateString("fr-FR")} {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {(ev.field_name || ev.old_value || ev.new_value) && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {ev.field_name && <span className="font-mono text-foreground">{ev.field_name}</span>}
                {ev.field_name && " : "}
                <span className="line-through opacity-60">{formatValue(ev.field_name, ev.old_value)}</span>
                <span className="mx-1">→</span>
                <span className="text-foreground">{formatValue(ev.field_name, ev.new_value)}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default HandoffEventsTimeline;