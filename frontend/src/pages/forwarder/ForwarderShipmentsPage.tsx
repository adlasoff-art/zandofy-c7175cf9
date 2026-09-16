/**
 * ForwarderShipmentsPage — TMS MVP: create/update off-marketplace shipments + copy public link.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Copy, Link2, Loader2, Plane, Ship, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "created", label: "Créée" },
  { value: "booked", label: "Réservée" },
  { value: "in_transit", label: "En transit" },
  { value: "customs", label: "Dédouanement" },
  { value: "arrived", label: "Arrivée" },
  { value: "out_for_delivery", label: "En livraison" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];

const MODE_OPTIONS = [
  { value: "air", label: "Aérien", icon: Plane },
  { value: "sea", label: "Maritime", icon: Ship },
  { value: "road", label: "Routier", icon: Truck },
  { value: "rail", label: "Ferroviaire", icon: Truck },
  { value: "multimodal", label: "Multimodal", icon: Package },
];

type ShipmentRow = {
  id: string;
  public_token: string;
  awb_bl: string | null;
  mode: string;
  status: string;
  origin: string | null;
  destination: string | null;
  eta: string | null;
  created_at: string;
  updated_at: string;
};

export default function ForwarderShipmentsPage() {
  const { forwarder } = useForwarderContext();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    awb_bl: "",
    mode: "air",
    origin: "",
    destination: "",
    consignee_name: "",
    eta: "",
    notes: "",
  });

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["forwarder-external-shipments", forwarder?.id],
    enabled: !!forwarder?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("external_shipments")
        .select("id, public_token, awb_bl, mode, status, origin, destination, eta, created_at, updated_at")
        .eq("forwarder_id", forwarder!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as ShipmentRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!forwarder?.id) throw new Error("Forwarder manquant");
      const { error } = await (supabase as any).from("external_shipments").insert({
        forwarder_id: forwarder.id,
        awb_bl: form.awb_bl.trim() || null,
        mode: form.mode,
        origin: form.origin.trim() || null,
        destination: form.destination.trim() || null,
        consignee_name: form.consignee_name.trim() || null,
        eta: form.eta || null,
        notes: form.notes.trim() || null,
        status: "created",
        events: [
          {
            at: new Date().toISOString(),
            status: "created",
            label: "Expédition créée",
          },
        ],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expédition créée");
      setShowForm(false);
      setForm({ awb_bl: "", mode: "air", origin: "", destination: "", consignee_name: "", eta: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["forwarder-external-shipments", forwarder?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Échec création"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const row = shipments.find((s) => s.id === id);
      const { data: current } = await (supabase as any)
        .from("external_shipments")
        .select("events")
        .eq("id", id)
        .maybeSingle();
      const events = Array.isArray(current?.events) ? [...current.events] : [];
      events.push({
        at: new Date().toISOString(),
        status,
        label: STATUS_OPTIONS.find((o) => o.value === status)?.label || status,
      });
      const { error } = await (supabase as any)
        .from("external_shipments")
        .update({ status, events })
        .eq("id", id);
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["forwarder-external-shipments", forwarder?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Échec mise à jour"),
  });

  const publicBase = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/t`;
  }, []);

  const copyLink = async (token: string) => {
    const url = `${publicBase}/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien public copié");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--forwarder-gradient)" }}
          >
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Expéditions externes</h1>
            <p className="text-xs text-muted-foreground">
              Suivi hors marketplace — partagez un lien public `/t/:token` avec vos clients.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5">
          <Plus size={14} /> Nouvelle expédition
        </Button>
      </header>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="AWB / BL"
              value={form.awb_bl}
              onChange={(e) => setForm((f) => ({ ...f, awb_bl: e.target.value }))}
            />
            <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Origine"
              value={form.origin}
              onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
            />
            <Input
              placeholder="Destination"
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
            />
            <Input
              placeholder="Destinataire (optionnel)"
              value={form.consignee_name}
              onChange={(e) => setForm((f) => ({ ...f, consignee_name: e.target.value }))}
            />
            <Input
              type="date"
              value={form.eta}
              onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))}
            />
          </div>
          <Input
            placeholder="Notes internes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={createMutation.isPending || (!form.origin.trim() && !form.destination.trim() && !form.awb_bl.trim())}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Créer"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : shipments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Aucune expédition externe pour le moment.
        </p>
      ) : (
        <div className="space-y-2">
          {shipments.map((s) => (
            <div
              key={s.id}
              className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">
                    {s.awb_bl || "Sans AWB"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {MODE_OPTIONS.find((m) => m.value === s.mode)?.label || s.mode}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {[s.origin, s.destination].filter(Boolean).join(" → ") || "Origine / destination non renseignées"}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Link2 size={10} /> /t/{s.public_token.slice(0, 8)}…
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Select
                  value={s.status}
                  onValueChange={(status) => updateStatusMutation.mutate({ id: s.id, status })}
                >
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => copyLink(s.public_token)}>
                  <Copy size={12} /> Lien
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
