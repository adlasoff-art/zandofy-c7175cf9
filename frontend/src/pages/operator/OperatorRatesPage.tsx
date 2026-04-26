/**
 * OperatorRatesPage — Lot 11B Phase B2 (CRUD tarifs par opérateur)
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { fromTable } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Banknote } from "lucide-react";

export default function OperatorRatesPage() {
  const { operator } = useOperatorContext();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ country_code: "CD", city: "", zone_name: "", commune: "", quartier: "", base_price: 0, surcharge: 0, price_per_km: 0, currency: "USD", estimated_minutes: 60 });

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["operator-rates", operator?.id],
    enabled: !!operator?.id,
    queryFn: async () => {
      const { data } = await fromTable("delivery_operator_rates").select("*").eq("operator_id", operator!.id).order("country_code, city, zone_name");
      return (data ?? []) as any[];
    },
  });

  const addRate = async () => {
    if (!operator || !form.city.trim() || !form.zone_name.trim()) { toast.error("Ville et zone obligatoires"); return; }
    setAdding(true);
    const { error } = await fromTable("delivery_operator_rates").insert({ ...form, operator_id: operator.id, is_active: true });
    setAdding(false);
    if (error) toast.error(error.message);
    else { toast.success("Tarif ajouté"); setForm({ ...form, zone_name: "", commune: "", quartier: "", base_price: 0 }); queryClient.invalidateQueries({ queryKey: ["operator-rates"] }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce tarif ?")) return;
    const { error } = await fromTable("delivery_operator_rates").delete().eq("id", id);
    if (error) toast.error(error.message); else queryClient.invalidateQueries({ queryKey: ["operator-rates"] });
  };

  const toggle = async (id: string, current: boolean) => {
    const { error } = await fromTable("delivery_operator_rates").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message); else queryClient.invalidateQueries({ queryKey: ["operator-rates"] });
  };

  if (!operator) return null;

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Tarifs</h1><p className="text-sm text-muted-foreground">Vos tarifs par zone géographique.</p></div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-1.5"><Plus size={14} />Ajouter un tarif</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><Label>Pays</Label><Input value={form.country_code} maxLength={3} onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })} /></div>
            <div><Label>Ville *</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Zone *</Label><Input value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} placeholder="Centre-ville" /></div>
            <div><Label>Commune</Label><Input value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
            <div><Label>Quartier</Label><Input value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} /></div>
            <div><Label>Prix base ($)</Label><Input type="number" min={0} step={0.01} value={form.base_price} onChange={(e) => setForm({ ...form, base_price: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Surcharge ($)</Label><Input type="number" min={0} step={0.01} value={form.surcharge} onChange={(e) => setForm({ ...form, surcharge: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Prix/km ($)</Label><Input type="number" min={0} step={0.01} value={form.price_per_km} onChange={(e) => setForm({ ...form, price_per_km: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <Button onClick={addRate} disabled={adding} style={{ background: "var(--operator-gradient)" }} className="text-white">
            {adding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Ajouter
          </Button>
        </CardContent>
      </Card>

      {isLoading && <Loader2 className="animate-spin mx-auto my-8" size={24} />}

      <div className="space-y-2">
        {rates.map((r) => (
          <Card key={r.id}><CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm flex items-center gap-1.5"><Banknote size={12} className="text-[hsl(var(--operator-primary))]" />{r.zone_name} — {r.city} ({r.country_code})</p>
              <p className="text-xs text-muted-foreground">
                {[r.commune, r.quartier].filter(Boolean).join(" / ") || "Toute la zone"} ·
                Base ${Number(r.base_price).toFixed(2)} + ${Number(r.surcharge).toFixed(2)} surcharge + ${Number(r.price_per_km).toFixed(2)}/km
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={r.is_active ? "default" : "outline"} onClick={() => toggle(r.id, r.is_active)}>{r.is_active ? "Actif" : "Inactif"}</Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 size={14} className="text-destructive" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}