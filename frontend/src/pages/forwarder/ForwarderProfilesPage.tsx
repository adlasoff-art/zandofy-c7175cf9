/**
 * ForwarderProfilesPage — CRUD profils tarifaires.
 * Tiers: réutilise les éditeurs admin (parité exacte kg/pièce/cbm/restrictions).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { fromTable } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Banknote, Edit, Plane, Ship, Truck, Train } from "lucide-react";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { KgTiersEditor } from "@/components/admin/forwarders/KgTiersEditor";
import { PieceTiersEditor } from "@/components/admin/forwarders/PieceTiersEditor";
import { CbmTiersEditor } from "@/components/admin/forwarders/CbmTiersEditor";
import { RestrictionsEditor } from "@/components/admin/forwarders/RestrictionsEditor";

const MODES = [
  { value: "air", label: "Aérien", icon: Plane },
  { value: "sea", label: "Maritime", icon: Ship },
  { value: "road", label: "Routier", icon: Truck },
  { value: "rail", label: "Ferroviaire", icon: Train },
];

export default function ForwarderProfilesPage() {
  const { forwarder } = useForwarderContext();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    mode: "air",
    country_code: "CD",
    currency: "USD",
    transit_min_days: 5,
    transit_max_days: 15,
    deposit_pct: 30,
    notes: "",
  });

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["forwarder-profiles", forwarder?.id],
    enabled: !!forwarder?.id,
    queryFn: async () => {
      const { data } = await fromTable("forwarder_pricing_profiles")
        .select("*")
        .eq("forwarder_id", forwarder!.id)
        .order("mode")
        .order("country_code");
      return (data ?? []) as any[];
    },
  });

  const create = async () => {
    if (!forwarder) return;
    if (!form.country_code.trim()) {
      toast.error("Pays obligatoire");
      return;
    }
    setCreating(true);
    const { error } = await fromTable("forwarder_pricing_profiles").insert({
      ...form,
      country_code: form.country_code.toUpperCase(),
      forwarder_id: forwarder.id,
      is_active: true,
    });
    setCreating(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profil créé");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["forwarder-profiles", forwarder.id] });
    }
  };

  const toggle = async (id: string, current: boolean) => {
    const { error } = await fromTable("forwarder_pricing_profiles")
      .update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["forwarder-profiles", forwarder?.id] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce profil et tous ses tiers ?")) return;
    const { error } = await fromTable("forwarder_pricing_profiles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["forwarder-profiles", forwarder?.id] });
  };

  if (!forwarder) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarifs</h1>
          <p className="text-sm text-muted-foreground">
            Profils par mode et pays de destination — mêmes grilles que l&apos;admin (kg, pièce, CBM).
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" style={{ background: "var(--forwarder-gradient)" }} className="text-white">
              <Plus size={14} /> Nouveau profil
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un profil tarifaire</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Mode *</Label>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <CountryCombobox
                    label="Pays destination *"
                    value={form.country_code}
                    onChange={(v) => setForm({ ...form, country_code: v })}
                    showNone={false}
                  />
                </div>
                <div>
                  <Label>Devise</Label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {["USD", "EUR", "CDF", "CNY", "XAF", "XOF", "ZAR"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Transit min (jours)</Label><Input type="number" min={1} value={form.transit_min_days} onChange={(e) => setForm({ ...form, transit_min_days: parseInt(e.target.value) || 1 })} /></div>
                <div><Label>Transit max (jours)</Label><Input type="number" min={1} value={form.transit_max_days} onChange={(e) => setForm({ ...form, transit_max_days: parseInt(e.target.value) || 1 })} /></div>
              </div>
              <div><Label>Acompte (%)</Label><Input type="number" min={0} max={100} value={form.deposit_pct} onChange={(e) => setForm({ ...form, deposit_pct: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Notes</Label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} className="w-full rounded-md border border-input bg-background p-2 text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} disabled={creating}>
                {creating ? <Loader2 className="animate-spin" size={14} /> : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <Loader2 className="animate-spin mx-auto my-8" size={24} />}
      {!isLoading && profiles.length === 0 && (
        <Card><CardContent className="pt-8 text-center text-sm text-muted-foreground">
          Aucun profil. Cliquez &quot;Nouveau profil&quot; pour commencer.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {profiles.map((p) => {
          const mode = MODES.find((m) => m.value === p.mode);
          const ModeIcon = mode?.icon ?? Banknote;
          return (
            <Card key={p.id}>
              <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm flex items-center gap-1.5">
                    <ModeIcon size={14} className="text-[hsl(var(--forwarder-primary))]" />
                    {mode?.label} — {p.country_code}
                    <Badge variant="outline" className="text-[10px]">{p.currency}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Transit {p.transit_min_days}-{p.transit_max_days}j · Acompte {p.deposit_pct}%
                    {p.notes && ` · ${p.notes}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Edit size={14} /> Tiers
                  </Button>
                  <Button size="sm" variant={p.is_active ? "default" : "outline"} onClick={() => toggle(p.id, p.is_active)}>
                    {p.is_active ? "Actif" : "Inactif"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Tiers — {editing && MODES.find((m) => m.value === editing.mode)?.label} {editing?.country_code}
            </SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-6 mt-4 pb-8">
              <KgTiersEditor profileId={editing.id} currency={editing.currency || "USD"} />
              <PieceTiersEditor profileId={editing.id} currency={editing.currency || "USD"} />
              <CbmTiersEditor profileId={editing.id} currency={editing.currency || "USD"} />
              <RestrictionsEditor profileId={editing.id} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
