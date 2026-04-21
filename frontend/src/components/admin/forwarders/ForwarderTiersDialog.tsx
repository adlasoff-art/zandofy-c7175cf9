import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Tier {
  id: string;
  forwarder_id: string;
  service_mode: string;
  min_weight_kg: number | null;
  max_weight_kg: number | null;
  price_per_kg: number;
  flat_fee: number;
  delay_days_min: number | null;
  delay_days_max: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  forwarderId: string | null;
  forwarderName?: string;
}

const MODES = [
  { value: "air", label: "Aérien" },
  { value: "sea", label: "Maritime" },
  { value: "road", label: "Routier" },
  { value: "express", label: "Express" },
];

const empty = {
  service_mode: "air",
  min_weight_kg: 0,
  max_weight_kg: 100,
  price_per_kg: 0,
  flat_fee: 0,
  delay_days_min: 5,
  delay_days_max: 10,
};

export function ForwarderTiersDialog({ open, onOpenChange, forwarderId, forwarderName }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof empty>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["forwarder-tiers", forwarderId],
    queryFn: async () => {
      if (!forwarderId) return [];
      const { data, error } = await sb
        .from("forwarder_service_tiers")
        .select("*")
        .eq("forwarder_id", forwarderId)
        .order("service_mode", { ascending: true })
        .order("min_weight_kg", { ascending: true });
      if (error) throw error;
      return data as Tier[];
    },
    enabled: !!forwarderId && open,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!forwarderId) return;
      const { error } = await sb.from("forwarder_service_tiers").insert({
        forwarder_id: forwarderId,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Palier ajouté");
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["forwarder-tiers", forwarderId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("forwarder_service_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["forwarder-tiers", forwarderId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign size={16} /> Tarifs — {forwarderName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add form */}
          <div className="border border-border rounded-lg p-3 bg-muted/20 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Mode</Label>
                <Select value={form.service_mode} onValueChange={(v) => setForm({ ...form, service_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Poids min (kg)</Label>
                <Input type="number" step="0.1" value={form.min_weight_kg}
                  onChange={(e) => setForm({ ...form, min_weight_kg: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Poids max (kg)</Label>
                <Input type="number" step="0.1" value={form.max_weight_kg}
                  onChange={(e) => setForm({ ...form, max_weight_kg: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Prix/kg ($)</Label>
                <Input type="number" step="0.01" value={form.price_per_kg}
                  onChange={(e) => setForm({ ...form, price_per_kg: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Frais fixes ($)</Label>
                <Input type="number" step="0.01" value={form.flat_fee}
                  onChange={(e) => setForm({ ...form, flat_fee: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Délai min (j)</Label>
                <Input type="number" value={form.delay_days_min ?? 0}
                  onChange={(e) => setForm({ ...form, delay_days_min: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Délai max (j)</Label>
                <Input type="number" value={form.delay_days_max ?? 0}
                  onChange={(e) => setForm({ ...form, delay_days_max: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-end">
                <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full">
                  {add.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} className="mr-1" />}
                  Ajouter
                </Button>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="border border-border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={18} /></div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun palier tarifaire défini.</p>
            ) : (
              <div className="divide-y divide-border text-sm">
                {rows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_auto] gap-2 items-center px-3 py-2">
                    <Badge variant="outline" className="capitalize w-fit">{r.service_mode}</Badge>
                    <span>{r.min_weight_kg ?? 0}–{r.max_weight_kg ?? "∞"} kg</span>
                    <span>${r.price_per_kg}/kg</span>
                    <span>+${r.flat_fee} fixe</span>
                    <span className="text-muted-foreground">{r.delay_days_min}-{r.delay_days_max} j</span>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}