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
import { z } from "zod";

interface Tier {
  id: string;
  forwarder_id: string;
  mode: string;
  tier: string;
  price_multiplier: number;
  transit_min_days: number | null;
  transit_max_days: number | null;
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
];

const TIERS = [
  { value: "express", label: "Express" },
  { value: "standard", label: "Standard" },
  { value: "vip", label: "VIP" },
];

const empty = {
  mode: "air",
  tier: "standard",
  price_multiplier: 1.0,
  transit_min_days: 5,
  transit_max_days: 10,
};

const tierSchema = z.object({
  mode: z.enum(["air", "sea"]),
  tier: z.enum(["express", "standard", "vip"]),
  price_multiplier: z.number().min(0.1).max(10),
  transit_min_days: z.number().int().min(0).max(365),
  transit_max_days: z.number().int().min(0).max(365),
}).refine((d) => d.transit_max_days >= d.transit_min_days, {
  message: "Délai max doit être ≥ délai min",
  path: ["transit_max_days"],
});

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
        .order("mode", { ascending: true })
        .order("tier", { ascending: true });
      if (error) throw error;
      return data as Tier[];
    },
    enabled: !!forwarderId && open,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!forwarderId) return;
      const parsed = tierSchema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Données invalides");
      }
      const { error } = await sb.from("forwarder_service_tiers").insert({
        forwarder_id: forwarderId,
        ...parsed.data,
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <div>
                <Label className="text-xs">Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Service</Label>
                <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Multiplicateur</Label>
                <Input type="number" step="0.01" min="0.1" max="10" value={form.price_multiplier}
                  onChange={(e) => setForm({ ...form, price_multiplier: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Délai min (j)</Label>
                <Input type="number" min="0" value={form.transit_min_days ?? 0}
                  onChange={(e) => setForm({ ...form, transit_min_days: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Délai max (j)</Label>
                <Input type="number" min="0" value={form.transit_max_days ?? 0}
                  onChange={(e) => setForm({ ...form, transit_max_days: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-end">
                <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full">
                  {add.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} className="mr-1" />}
                  Ajouter
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Le prix final = prix de base × multiplicateur. Ex: 1.0 = standard, 1.3 = +30%, 0.9 = −10%.
            </p>
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
                  <div key={r.id} className="grid grid-cols-[70px_90px_1fr_1fr_auto] gap-2 items-center px-3 py-2">
                    <Badge variant="outline" className="capitalize w-fit">{r.mode}</Badge>
                    <Badge variant="secondary" className="capitalize w-fit">{r.tier}</Badge>
                    <span>×{Number(r.price_multiplier).toFixed(2)}</span>
                    <span className="text-muted-foreground">{r.transit_min_days ?? "?"}–{r.transit_max_days ?? "?"} j</span>
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