/**
 * ForwarderProfilesPage — CRUD profils tarifaires (auto-éditable).
 * RLS : user_owns_forwarder / user_owns_forwarder_profile.
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
    mode: "road",
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
    setCreating(true);
    const { error } = await fromTable("forwarder_pricing_profiles").insert({
      ...form,
      forwarder_id: forwarder.id,
      is_active: true,
    });
    setCreating(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profil créé");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["forwarder-profiles"] });
    }
  };

  const toggle = async (id: string, current: boolean) => {
    const { error } = await fromTable("forwarder_pricing_profiles")
      .update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["forwarder-profiles"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce profil et tous ses tiers ?")) return;
    const { error } = await fromTable("forwarder_pricing_profiles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["forwarder-profiles"] });
  };

  if (!forwarder) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarifs</h1>
          <p className="text-sm text-muted-foreground">
            Vos profils tarifaires par mode et origine.
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
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Pays origine *</Label><Input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })} maxLength={2} /></div>
                <div><Label>Devise</Label>
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
          Aucun profil. Cliquez "Nouveau profil" pour commencer.
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
          {editing && <ProfileTiersEditor profile={editing} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------- Tiers editor (KG / CBM / Pièce / Surcharges) ---------- */
function ProfileTiersEditor({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["forwarder-tiers", profile.id] });

  const { data: kg = [] } = useQuery({
    queryKey: ["forwarder-tiers", profile.id, "kg"],
    queryFn: async () => {
      const { data } = await fromTable("forwarder_kg_tiers").select("*").eq("profile_id", profile.id).order("min_kg");
      return (data ?? []) as any[];
    },
  });
  const { data: cbm = [] } = useQuery({
    queryKey: ["forwarder-tiers", profile.id, "cbm"],
    queryFn: async () => {
      const { data } = await fromTable("forwarder_cbm_tiers").select("*").eq("profile_id", profile.id).order("min_cbm");
      return (data ?? []) as any[];
    },
  });
  const { data: surch = [] } = useQuery({
    queryKey: ["forwarder-tiers", profile.id, "surch"],
    queryFn: async () => {
      const { data } = await fromTable("forwarder_surcharges").select("*").eq("profile_id", profile.id).order("sort_order");
      return (data ?? []) as any[];
    },
  });

  const addKg = async () => {
    const last = kg[kg.length - 1];
    const min = last ? Number(last.max_kg) : 0;
    const { error } = await fromTable("forwarder_kg_tiers").insert({
      profile_id: profile.id, min_kg: min, max_kg: min + 10, price_per_kg: 0,
    });
    if (error) toast.error(error.message); else { toast.success("Tier KG ajouté"); inv(); }
  };
  const addCbm = async () => {
    const last = cbm[cbm.length - 1];
    const min = last ? Number(last.max_cbm) : 0;
    const { error } = await fromTable("forwarder_cbm_tiers").insert({
      profile_id: profile.id, min_cbm: min, max_cbm: min + 1, price_per_cbm: 0,
    });
    if (error) toast.error(error.message); else { toast.success("Tier CBM ajouté"); inv(); }
  };
  const addSurch = async () => {
    const { error } = await fromTable("forwarder_surcharges").insert({
      profile_id: profile.id, label: "Nouvelle surcharge", surcharge_type: "flat", amount: 0, currency: profile.currency,
    });
    if (error) toast.error(error.message); else { toast.success("Surcharge ajoutée"); inv(); }
  };
  const update = async (table: string, id: string, patch: any) => {
    const { error } = await fromTable(table).update(patch).eq("id", id);
    if (error) toast.error(error.message); else inv();
  };
  const remove = async (table: string, id: string) => {
    const { error } = await fromTable(table).delete().eq("id", id);
    if (error) toast.error(error.message); else inv();
  };

  return (
    <div className="space-y-5 mt-4">
      <Section title="Tiers KG" onAdd={addKg}>
        {kg.length === 0 && <Empty />}
        {kg.map((t: any) => (
          <Row3 key={t.id}
            a={<Input type="number" defaultValue={t.min_kg} onBlur={(e) => update("forwarder_kg_tiers", t.id, { min_kg: parseFloat(e.target.value) || 0 })} />}
            b={<Input type="number" defaultValue={t.max_kg} onBlur={(e) => update("forwarder_kg_tiers", t.id, { max_kg: parseFloat(e.target.value) || 0 })} />}
            c={<Input type="number" step="0.01" defaultValue={t.price_per_kg} onBlur={(e) => update("forwarder_kg_tiers", t.id, { price_per_kg: parseFloat(e.target.value) || 0 })} />}
            onRemove={() => remove("forwarder_kg_tiers", t.id)}
            labels={["min kg", "max kg", "$/kg"]}
          />
        ))}
      </Section>

      <Section title="Tiers CBM" onAdd={addCbm}>
        {cbm.length === 0 && <Empty />}
        {cbm.map((t: any) => (
          <Row3 key={t.id}
            a={<Input type="number" step="0.01" defaultValue={t.min_cbm} onBlur={(e) => update("forwarder_cbm_tiers", t.id, { min_cbm: parseFloat(e.target.value) || 0 })} />}
            b={<Input type="number" step="0.01" defaultValue={t.max_cbm} onBlur={(e) => update("forwarder_cbm_tiers", t.id, { max_cbm: parseFloat(e.target.value) || 0 })} />}
            c={<Input type="number" step="0.01" defaultValue={t.price_per_cbm} onBlur={(e) => update("forwarder_cbm_tiers", t.id, { price_per_cbm: parseFloat(e.target.value) || 0 })} />}
            onRemove={() => remove("forwarder_cbm_tiers", t.id)}
            labels={["min m³", "max m³", "$/m³"]}
          />
        ))}
      </Section>

      <Section title="Surcharges" onAdd={addSurch}>
        {surch.length === 0 && <Empty />}
        {surch.map((s: any) => (
          <Row3 key={s.id}
            a={<Input defaultValue={s.label} onBlur={(e) => update("forwarder_surcharges", s.id, { label: e.target.value })} />}
            b={
              <select defaultValue={s.surcharge_type}
                onChange={(e) => update("forwarder_surcharges", s.id, { surcharge_type: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="flat">Forfait</option>
                <option value="percent">% sur fret</option>
                <option value="per_kg">par kg</option>
              </select>
            }
            c={<Input type="number" step="0.01" defaultValue={s.amount} onBlur={(e) => update("forwarder_surcharges", s.id, { amount: parseFloat(e.target.value) || 0 })} />}
            onRemove={() => remove("forwarder_surcharges", s.id)}
            labels={["Libellé", "Type", "Montant"]}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Button size="sm" variant="outline" onClick={onAdd}><Plus size={12} /> Ajouter</Button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground italic px-2">Aucun élément.</p>;
}

function Row3({ a, b, c, onRemove, labels }: { a: React.ReactNode; b: React.ReactNode; c: React.ReactNode; onRemove: () => void; labels: [string, string, string] }) {
  return (
    <div className="grid grid-cols-12 gap-1.5 items-end">
      <div className="col-span-3"><Label className="text-[10px]">{labels[0]}</Label>{a}</div>
      <div className="col-span-3"><Label className="text-[10px]">{labels[1]}</Label>{b}</div>
      <div className="col-span-5"><Label className="text-[10px]">{labels[2]}</Label>{c}</div>
      <div className="col-span-1">
        <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 size={12} className="text-destructive" /></Button>
      </div>
    </div>
  );
}