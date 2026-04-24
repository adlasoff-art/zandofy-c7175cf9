import { useEffect, useState } from "react";
import { Loader2, Package, RefreshCw, CheckCircle2, Truck, PackageCheck, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/**
 * ForwarderHandoffsPanel — operational view for a linked transporter user.
 * Lists incoming handoffs and allows status updates (acknowledged, in_transit, delivered, cancelled).
 * RLS ensures the user only sees/updates handoffs of forwarders they are linked to.
 */

type HandoffStatus =
  | "pending"
  | "notified"
  | "acknowledged"
  | "in_transit"
  | "delivered"
  | "cancelled";

interface HandoffRow {
  id: string;
  order_id: string;
  forwarder_id: string;
  status: HandoffStatus;
  notification_payload: any;
  notified_at: string | null;
  acknowledged_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  forwarder_name?: string | null;
  order_ref?: string | null;
  shipping_city?: string | null;
  shipping_country?: string | null;
}

const STATUS_META: Record<HandoffStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: JSX.Element }> = {
  pending: { label: "En attente", variant: "secondary", icon: <Clock size={12} /> },
  notified: { label: "Notifié", variant: "default", icon: <Package size={12} /> },
  acknowledged: { label: "Reçu", variant: "default", icon: <CheckCircle2 size={12} /> },
  in_transit: { label: "En transit", variant: "default", icon: <Truck size={12} /> },
  delivered: { label: "Livré", variant: "default", icon: <PackageCheck size={12} /> },
  cancelled: { label: "Annulé", variant: "destructive", icon: <XCircle size={12} /> },
};

const NEXT_ACTIONS: Partial<Record<HandoffStatus, { to: HandoffStatus; label: string }[]>> = {
  pending: [{ to: "acknowledged", label: "Marquer reçu" }],
  notified: [{ to: "acknowledged", label: "Marquer reçu" }],
  acknowledged: [{ to: "in_transit", label: "Marquer expédié" }],
  in_transit: [{ to: "delivered", label: "Marquer livré" }],
};

interface Props {
  forwarderIds: string[];
  forwarderNames: Record<string, string>;
}

export function ForwarderHandoffsPanel({ forwarderIds, forwarderNames }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HandoffRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const fetchHandoffs = async () => {
    if (forwarderIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("forwarder_handoffs")
      .select(
        "id, order_id, forwarder_id, status, notification_payload, notified_at, acknowledged_at, internal_notes, created_at, updated_at",
      )
      .in("forwarder_id", forwarderIds)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Erreur de chargement", { description: error.message });
      setLoading(false);
      return;
    }

    const handoffs = (data ?? []) as HandoffRow[];
    const orderIds = [...new Set(handoffs.map((h) => h.order_id))];

    let orderMap = new Map<string, { order_ref: string | null; shipping_city: string | null; shipping_country: string | null }>();
    if (orderIds.length > 0) {
      const { data: orders } = await (supabase as any)
        .from("orders")
        .select("id, order_ref, shipping_city, shipping_country")
        .in("id", orderIds);
      orderMap = new Map(
        (orders ?? []).map((o: any) => [o.id, { order_ref: o.order_ref, shipping_city: o.shipping_city, shipping_country: o.shipping_country }]),
      );
    }

    setRows(
      handoffs.map((h) => ({
        ...h,
        forwarder_name: forwarderNames[h.forwarder_id] ?? null,
        order_ref: orderMap.get(h.order_id)?.order_ref ?? null,
        shipping_city: orderMap.get(h.order_id)?.shipping_city ?? null,
        shipping_country: orderMap.get(h.order_id)?.shipping_country ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchHandoffs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwarderIds.join(",")]);

  const updateStatus = async (row: HandoffRow, next: HandoffStatus) => {
    setSavingId(row.id);
    const patch: Record<string, any> = { status: next };
    if (next === "acknowledged" && !row.acknowledged_at) {
      patch.acknowledged_at = new Date().toISOString();
    }
    const { error } = await (supabase as any)
      .from("forwarder_handoffs")
      .update(patch)
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast.error("Mise à jour échouée", { description: error.message });
      return;
    }
    toast.success(`Statut mis à jour: ${STATUS_META[next].label}`);
    fetchHandoffs();
  };

  const saveNotes = async (row: HandoffRow) => {
    const draft = notesDraft[row.id];
    if (draft === undefined || draft === (row.internal_notes ?? "")) return;
    setSavingId(row.id);
    const { error } = await (supabase as any)
      .from("forwarder_handoffs")
      .update({ internal_notes: draft })
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast.error("Note non enregistrée", { description: error.message });
      return;
    }
    toast.success("Note enregistrée");
    fetchHandoffs();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 rounded-xl border border-border bg-card">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 p-4 border-b border-border bg-muted/20">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Package size={18} className="text-primary" /> Commandes à traiter
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows.length} commande{rows.length > 1 ? "s" : ""} reçue{rows.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHandoffs}>
          <RefreshCw size={14} className="mr-1" /> Rafraîchir
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Aucune commande à traiter pour le moment.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const meta = STATUS_META[row.status];
            const actions = NEXT_ACTIONS[row.status] ?? [];
            const payload = row.notification_payload ?? {};
            return (
              <div key={row.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {row.order_ref ?? row.order_id.slice(0, 8)}
                      </span>
                      <Badge variant={meta.variant} className="gap-1">
                        {meta.icon}
                        {meta.label}
                      </Badge>
                      {row.forwarder_name && (
                        <Badge variant="outline" className="text-[10px]">
                          {row.forwarder_name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      {(row.shipping_city || row.shipping_country) && (
                        <span>
                          Destination: {[row.shipping_city, row.shipping_country].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <span>Reçu le {new Date(row.created_at).toLocaleString("fr-FR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {actions.map((a) => (
                      <Button
                        key={a.to}
                        size="sm"
                        disabled={savingId === row.id}
                        onClick={() => updateStatus(row, a.to)}
                      >
                        {savingId === row.id ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                        {a.label}
                      </Button>
                    ))}
                    {row.status !== "cancelled" && row.status !== "delivered" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={savingId === row.id}
                        onClick={() => updateStatus(row, "cancelled")}
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/30 px-2 py-1.5">
                    <div className="text-muted-foreground">Colis</div>
                    <div className="font-semibold text-foreground">{payload.pieces_count ?? "—"}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-2 py-1.5">
                    <div className="text-muted-foreground">Poids</div>
                    <div className="font-semibold text-foreground">
                      {payload.weight_kg != null ? `${payload.weight_kg} kg` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-2 py-1.5">
                    <div className="text-muted-foreground">CBM</div>
                    <div className="font-semibold text-foreground">
                      {payload.cbm != null ? `${payload.cbm} m³` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-2 py-1.5">
                    <div className="text-muted-foreground">Tarif</div>
                    <div className="font-semibold text-foreground">
                      {payload.quoted_price != null
                        ? `${payload.quoted_price} ${payload.currency ?? ""}`.trim()
                        : "—"}
                    </div>
                  </div>
                </div>

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Notes internes
                  </summary>
                  <div className="mt-2 space-y-2">
                    <Textarea
                      rows={2}
                      placeholder="Suivi interne, n° de tracking, remarques…"
                      defaultValue={row.internal_notes ?? ""}
                      onChange={(e) => setNotesDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === row.id}
                        onClick={() => saveNotes(row)}
                      >
                        Enregistrer la note
                      </Button>
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}