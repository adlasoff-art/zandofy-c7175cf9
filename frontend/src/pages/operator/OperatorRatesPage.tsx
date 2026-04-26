/**
 * OperatorRatesPage — Lot 11B Phase B2 (CRUD tarifs par opérateur)
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Banknote, ShieldAlert, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

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

  const { data: caps = [] } = useQuery({
    queryKey: ["operator-city-caps"],
    queryFn: async () => {
      const { data } = await fromTable("delivery_operator_city_caps").select("*");
      return (data ?? []) as any[];
    },
  });

  const findCap = (city: string, country: string) =>
    caps.find(
      (c: any) =>
        c.city?.toLowerCase() === city.toLowerCase() &&
        c.country_code?.toUpperCase() === country.toUpperCase()
    );

  const isPlatform = !!operator?.is_platform_owned;
  const formCap = findCap(form.city, form.country_code);
  const overBase = !isPlatform && !!formCap && form.base_price > Number(formCap.max_base_price);
  const overSurcharge = !isPlatform && !!formCap && form.surcharge > Number(formCap.max_surcharge);
  const overEta = !isPlatform && !!formCap && form.estimated_minutes > Number(formCap.max_estimated_minutes);
  const formBlocked = overBase || overSurcharge || overEta;

  const addRate = async () => {
    if (!operator || !form.city.trim() || !form.zone_name.trim()) { toast.error("Ville et zone obligatoires"); return; }
    if (formBlocked) { toast.error("Tarif au-dessus du plafond admin de la ville"); return; }
    setAdding(true);
    const { data: inserted, error } = await fromTable("delivery_operator_rates")
      .insert({ ...form, operator_id: operator.id, is_active: true })
      .select("id, status")
      .single();
    setAdding(false);
    if (error) toast.error(error.message);
    else {
      toast.success(isPlatform
        ? "Tarif ajouté"
        : "Tarif soumis à validation admin — apparaîtra au checkout après approbation");
      setForm({ ...form, zone_name: "", commune: "", quartier: "", base_price: 0 });
      queryClient.invalidateQueries({ queryKey: ["operator-rates"] });
      // Phase 6 — notify admins by email (in-app notif handled by DB trigger)
      if (!isPlatform && inserted?.id && (inserted as any)?.status === "pending") {
        supabase.functions
          .invoke("notify-admin-operator-rate", { body: { rateId: (inserted as any).id } })
          .catch((e) => console.warn("[notify-admin-operator-rate]", e));
      }
    }
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

          {!isPlatform && form.city && (
            formCap ? (
              <div className={`text-xs rounded p-2 flex items-start gap-2 ${formBlocked ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <div>
                  <div>Plafond admin pour {form.city} ({form.country_code}) : base ≤ ${Number(formCap.max_base_price).toFixed(2)} · surcharge ≤ ${Number(formCap.max_surcharge).toFixed(2)} · ETA ≤ {formCap.max_estimated_minutes} min.</div>
                  {formBlocked && <div className="font-medium mt-1">Votre tarif dépasse ce plafond — soumission bloquée.</div>}
                </div>
              </div>
            ) : (
              <div className="text-xs rounded p-2 flex items-start gap-2 bg-muted text-muted-foreground">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Aucun plafond admin défini pour cette ville. Tarif soumis à validation manuelle.
              </div>
            )
          )}

          {!isPlatform && (
            <p className="text-xs text-muted-foreground">
              Tout nouveau tarif est soumis à validation admin avant d'apparaître au checkout.
            </p>
          )}

          <Button onClick={addRate} disabled={adding || formBlocked} style={{ background: "var(--operator-gradient)" }} className="text-white">
            {adding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Ajouter
          </Button>
        </CardContent>
      </Card>

      {isLoading && <Loader2 className="animate-spin mx-auto my-8" size={24} />}

      <div className="space-y-2">
        {rates.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-3 pb-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                    <Banknote size={12} className="text-[hsl(var(--operator-primary))]" />
                    {r.zone_name} — {r.city} ({r.country_code})
                    <StatusBadge status={r.status} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[r.commune, r.quartier].filter(Boolean).join(" / ") || "Toute la zone"} ·
                    Base ${Number(r.base_price).toFixed(2)} + ${Number(r.surcharge).toFixed(2)} surcharge + ${Number(r.price_per_km).toFixed(2)}/km
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={r.is_active ? "default" : "outline"} onClick={() => toggle(r.id, r.is_active)}>{r.is_active ? "Actif" : "Inactif"}</Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 size={14} className="text-destructive" /></Button>
                </div>
              </div>
              {r.status === "rejected" && r.rejection_reason && (
                <div className="text-xs rounded p-2 bg-destructive/10 text-destructive flex items-start gap-2">
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                  <div><span className="font-medium">Refusé : </span>{r.rejection_reason}</div>
                </div>
              )}
              {r.status === "pending" && !isPlatform && (
                <div className="text-xs rounded p-2 bg-muted text-muted-foreground flex items-start gap-2">
                  <Clock size={14} className="mt-0.5 shrink-0" />
                  En attente de validation admin — non visible au checkout pour le moment.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === "approved") {
    return (
      <Badge variant="outline" className="text-[10px] gap-1">
        <CheckCircle2 size={10} /> Approuvé
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1">
        <Clock size={10} /> En attente
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <XCircle size={10} /> Refusé
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}