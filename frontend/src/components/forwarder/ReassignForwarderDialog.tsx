/**
 * ReassignForwarderDialog.tsx
 *
 * Permet à un vendeur ou admin de réassigner un transitaire pour une commande.
 * - Vendeur (mode='vendor') : liste filtrée par éligibilité ville client
 * - Admin (mode='admin')    : tous les transitaires actifs + onglet "Multi-hop"
 *
 * Appels RPC :
 *  - reassign_forwarder(handoff_id, new_forwarder_id, reason, actor_role)
 *  - add_intermediate_hub_handoff(order_id, hub_forwarder_id, destination_city, reason)
 */

import { useEffect, useState } from "react";
import { Loader2, Truck, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchEligibleForwarders, type EligibleForwarder } from "@/services/forwarders";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "vendor" | "admin";
  orderId: string;
  handoffId: string | null;            // null => pas de handoff actif (admin only multi-hop)
  shippingCountry: string | null;
  shippingCity?: string | null;
  currentForwarderId?: string | null;
  freightMode?: string | null;          // 'air' | 'sea' | ...
  onSuccess?: () => void;
}

interface ForwarderRow {
  id: string;
  name: string;
  is_active: boolean;
}

export function ReassignForwarderDialog({
  open,
  onOpenChange,
  mode,
  orderId,
  handoffId,
  shippingCountry,
  shippingCity,
  currentForwarderId,
  freightMode,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Onglet remplacement
  const [eligible, setEligible] = useState<EligibleForwarder[]>([]);
  const [allForwarders, setAllForwarders] = useState<ForwarderRow[]>([]);
  const [selectedForwarder, setSelectedForwarder] = useState<string>("");
  const [reason, setReason] = useState("");

  // Onglet multi-hop (admin only)
  const [hubForwarder, setHubForwarder] = useState<string>("");
  const [transitCity, setTransitCity] = useState("");
  const [hubReason, setHubReason] = useState("");

  useEffect(() => {
    if (!open) return;
    void loadOptions();
    // reset state
    setSelectedForwarder("");
    setReason("");
    setHubForwarder("");
    setTransitCity("");
    setHubReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadOptions = async () => {
    setLoading(true);
    try {
      // Vendor : éligibles à la ville client
      const elig = await fetchEligibleForwarders({
        country: shippingCountry || "",
        cityId: null,
        mode: freightMode || "air",
      });
      setEligible(elig.filter((f) => f.forwarder_id !== currentForwarderId));

      // Admin : tous les transitaires actifs
      if (mode === "admin") {
        const { data } = await (supabase as any)
          .from("forwarders")
          .select("id, name, is_active")
          .eq("is_active", true)
          .order("name");
        setAllForwarders(((data || []) as ForwarderRow[]).filter((f) => f.id !== currentForwarderId));
      }
    } catch (err: any) {
      toast.error("Chargement impossible", { description: err?.message ?? String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!handoffId) {
      toast.error("Aucun transitaire actif à remplacer");
      return;
    }
    if (!selectedForwarder) {
      toast.error("Sélectionne un transitaire");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Raison obligatoire (min 3 caractères)");
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase.rpc as any)("reassign_forwarder", {
      p_handoff_id: handoffId,
      p_new_forwarder_id: selectedForwarder,
      p_reason: reason.trim(),
      p_actor_role: mode,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Réassignation échouée", { description: error.message });
      return;
    }
    toast.success("Transitaire mis à jour");
    onOpenChange(false);
    onSuccess?.();
  };

  const handleMultiHop = async () => {
    if (!hubForwarder) {
      toast.error("Sélectionne un transitaire de transit");
      return;
    }
    if (transitCity.trim().length < 2) {
      toast.error("Indique la ville de transit");
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase.rpc as any)("add_intermediate_hub_handoff", {
      p_order_id: orderId,
      p_hub_forwarder_id: hubForwarder,
      p_destination_city: transitCity.trim(),
      p_reason: hubReason.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Création du leg échouée", { description: error.message });
      return;
    }
    toast.success("Étape intermédiaire ajoutée");
    onOpenChange(false);
    onSuccess?.();
  };

  const vendorList = eligible.map((f) => ({ id: f.forwarder_id, name: f.forwarder_name }));
  const replacementList = mode === "admin" ? allForwarders : vendorList;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck size={18} className="text-primary" />
            {mode === "admin" ? "Réassigner / router le transitaire" : "Changer de transitaire"}
          </DialogTitle>
          <DialogDescription>
            {mode === "vendor"
              ? "Uniquement les transitaires couvrant la ville du client sont proposés."
              : "Remplacement libre ou ajout d'une étape intermédiaire (multi-hop)."}
          </DialogDescription>
        </DialogHeader>

        {mode === "admin" ? (
          <Tabs defaultValue="replace">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="replace" className="gap-1"><Truck size={12} /> Remplacement</TabsTrigger>
              <TabsTrigger value="hub" className="gap-1"><Route size={12} /> Multi-hop</TabsTrigger>
            </TabsList>
            <TabsContent value="replace" className="space-y-3 pt-3">
              <ReplaceForm
                loading={loading}
                list={replacementList}
                selected={selectedForwarder}
                onSelect={setSelectedForwarder}
                reason={reason}
                onReason={setReason}
              />
            </TabsContent>
            <TabsContent value="hub" className="space-y-3 pt-3">
              <div>
                <Label>Transitaire pour l'étape de transit</Label>
                <select
                  className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={hubForwarder}
                  onChange={(e) => setHubForwarder(e.target.value)}
                >
                  <option value="">— choisir —</option>
                  {allForwarders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Ville de transit (ex. Kinshasa)</Label>
                <Input value={transitCity} onChange={(e) => setTransitCity(e.target.value)} placeholder="Kinshasa" />
              </div>
              <div>
                <Label>Raison (optionnelle)</Label>
                <Textarea rows={2} value={hubReason} onChange={(e) => setHubReason(e.target.value)} placeholder="Ex. Transitaire principal ne dessert plus Lubumbashi en direct" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
                <Button onClick={handleMultiHop} disabled={submitting || loading}>
                  {submitting && <Loader2 className="animate-spin mr-1" size={14} />}
                  Ajouter l'étape
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3 pt-1">
            <ReplaceForm
              loading={loading}
              list={replacementList}
              selected={selectedForwarder}
              onSelect={setSelectedForwarder}
              reason={reason}
              onReason={setReason}
              emptyHint="Aucun autre transitaire ne couvre la ville du client."
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
              <Button onClick={handleReassign} disabled={submitting || loading}>
                {submitting && <Loader2 className="animate-spin mr-1" size={14} />}
                Confirmer le changement
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "admin" && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleReassign} disabled={submitting || loading || !selectedForwarder} variant="default">
              {submitting && <Loader2 className="animate-spin mr-1" size={14} />}
              Confirmer le remplacement
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReplaceForm({
  loading,
  list,
  selected,
  onSelect,
  reason,
  onReason,
  emptyHint,
}: {
  loading: boolean;
  list: { id: string; name: string }[];
  selected: string;
  onSelect: (v: string) => void;
  reason: string;
  onReason: (v: string) => void;
  emptyHint?: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={16} /> Chargement…
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {emptyHint ?? "Aucun transitaire disponible."}
      </p>
    );
  }
  return (
    <>
      <div>
        <Label>Nouveau transitaire</Label>
        <select
          className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">— choisir —</option>
          {list.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Raison du changement *</Label>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          placeholder="Ex. Transitaire d'origine en grève, délai trop long, indisponibilité…"
        />
      </div>
    </>
  );
}