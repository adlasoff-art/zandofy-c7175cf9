/**
 * AdminOperatorRatesPage — Lot final consolidation
 *
 * Permet à un admin de créer des tarifs (auto-approuvés) au nom d'un opérateur
 * et de visualiser ses tarifs existants. Route: /admin/operators/:operatorId/rates
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2, MapPin, Pencil, RefreshCw } from "lucide-react";
import { GeoFieldsRow, type GeoFieldsValue } from "@/components/address/GeoFieldsRow";

type Rate = {
  id: string;
  zone_name: string;
  city: string;
  country_code: string;
  commune: string | null;
  quartier: string | null;
  base_price: number;
  surcharge: number;
  price_per_km: number;
  currency: string;
  estimated_minutes: number;
  status: string;
  is_active: boolean;
  created_at: string;
};

const initialForm = {
  zone_name: "",
  base_price: "",
  surcharge: "0",
  price_per_km: "0",
  currency: "USD",
  estimated_minutes: "45",
};

const initialGeo: GeoFieldsValue = { country: "CD", city: "", commune: "", quartier: "" };

export default function AdminOperatorRatesPage() {
  const { operatorId } = useParams<{ operatorId: string }>();
  const qc = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [geo, setGeo] = useState<GeoFieldsValue>(initialGeo);
  const [editTarget, setEditTarget] = useState<Rate | null>(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editGeo, setEditGeo] = useState<GeoFieldsValue>(initialGeo);

  const { data: operator } = useQuery({
    queryKey: ["admin-operator", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_operators")
        .select("id, company_name, contact_email, status, archived_at, platform_commission_pct")
        .eq("id", operatorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rates, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-operator-rates", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_operator_rates")
        .select("*")
        .eq("operator_id", operatorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Rate[];
    },
  });

  const createRate = useMutation({
    mutationFn: async () => {
      if (!operatorId) throw new Error("Missing operator");
      if (!geo.country || !geo.city?.trim() || !form.zone_name.trim() || !form.base_price)
        throw new Error("Ville, zone et tarif de base requis");
      const body = {
        operator_id: operatorId,
        country_code: (geo.country || "").toUpperCase(),
        city: geo.city.trim(),
        zone_name: form.zone_name.trim(),
        commune: geo.commune?.trim() || null,
        quartier: geo.quartier?.trim() || null,
        base_price: Number(form.base_price),
        surcharge: Number(form.surcharge) || 0,
        price_per_km: Number(form.price_per_km) || 0,
        currency: form.currency.toUpperCase(),
        estimated_minutes: Number(form.estimated_minutes) || 45,
      };
      const { data, error } = await supabase.functions.invoke("admin-create-operator-rate", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { success: boolean; rate_id: string; rate: Rate };
    },
    onSuccess: async (data) => {
      toast.success("Tarif créé et auto-approuvé");
      setForm(initialForm);
      setGeo(initialGeo);
      // Refetch immédiat + vérification de présence (anti-faux-succès)
      const result = await refetch();
      const found = (result.data || []).some((r) => r.id === data.rate_id);
      if (!found) {
        toast.error("Tarif inséré mais introuvable après rechargement — vérifiez la base.");
      }
      qc.invalidateQueries({ queryKey: ["admin-operator-rates", operatorId] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const toggleActive = useMutation({
    mutationFn: async (rate: Rate) => {
      const { error } = await (supabase as any)
        .from("delivery_operator_rates")
        .update({ is_active: !rate.is_active })
        .eq("id", rate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarif mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-operator-rates", operatorId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRate = useMutation({
    mutationFn: async () => {
      if (!editTarget) throw new Error("Aucun tarif à modifier");
      if (!editGeo.country || !editGeo.city?.trim() || !editForm.zone_name.trim() || !editForm.base_price)
        throw new Error("Ville, zone et tarif de base requis");
      const body = {
        rate_id: editTarget.id,
        country_code: (editGeo.country || "").toUpperCase(),
        city: editGeo.city.trim(),
        zone_name: editForm.zone_name.trim(),
        commune: editGeo.commune?.trim() || null,
        quartier: editGeo.quartier?.trim() || null,
        base_price: Number(editForm.base_price),
        surcharge: Number(editForm.surcharge) || 0,
        price_per_km: Number(editForm.price_per_km) || 0,
        currency: editForm.currency.toUpperCase(),
        estimated_minutes: Number(editForm.estimated_minutes) || 45,
      };
      const { data, error } = await supabase.functions.invoke("admin-update-operator-rate", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: async () => {
      toast.success("Tarif mis à jour");
      setEditTarget(null);
      await refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const openEdit = (r: Rate) => {
    setEditTarget(r);
    setEditForm({
      zone_name: r.zone_name,
      base_price: String(r.base_price),
      surcharge: String(r.surcharge ?? 0),
      price_per_km: String((r as any).price_per_km ?? 0),
      currency: r.currency,
      estimated_minutes: String(r.estimated_minutes),
    });
    setEditGeo({
      country: r.country_code,
      city: r.city,
      commune: r.commune ?? "",
      quartier: r.quartier ?? "",
    });
  };

  return (
    <AdminLayout title="Tarifs opérateur">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/operators"><ArrowLeft size={14} className="mr-1" /> Opérateurs</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={`mr-1 ${isFetching ? "animate-spin" : ""}`} /> Rafraîchir
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Tarifs — {operator?.company_name || "…"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Création de tarifs au nom de l'opérateur (auto-approuvés). Commission plateforme :
            {" "}{operator?.platform_commission_pct ?? "—"}%.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus size={16} /> Nouveau tarif
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <GeoFieldsRow
                value={geo}
                onChange={(patch) => setGeo({ ...geo, ...patch })}
                levels={["country", "city", "commune", "quartier"]}
                required={["country", "city"]}
              />
            </div>
            <div>
              <Label>Nom de la zone *</Label>
              <Input value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} placeholder="Centre-ville" />
            </div>
            <div>
              <Label>Devise</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div>
              <Label>Tarif de base *</Label>
              <Input type="number" step="0.01" min="0" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
            </div>
            <div>
              <Label>Surcharge</Label>
              <Input type="number" step="0.01" min="0" value={form.surcharge} onChange={(e) => setForm({ ...form, surcharge: e.target.value })} />
            </div>
            <div>
              <Label>Prix / km</Label>
              <Input type="number" step="0.01" min="0" value={form.price_per_km} onChange={(e) => setForm({ ...form, price_per_km: e.target.value })} />
            </div>
            <div>
              <Label>Délai estimé (min)</Label>
              <Input type="number" min="1" value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button onClick={() => createRate.mutate()} disabled={createRate.isPending}>
                {createRate.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
                Créer le tarif
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin size={16} /> Tarifs existants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin" /></div>
            ) : !rates || rates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucun tarif enregistré.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Surcharge</TableHead>
                    <TableHead>Délai</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.zone_name}</TableCell>
                      <TableCell className="text-xs">
                        {r.city}, {r.country_code}
                        {r.commune && <> · {r.commune}</>}
                        {r.quartier && <> · {r.quartier}</>}
                      </TableCell>
                      <TableCell>{r.base_price.toFixed(2)} {r.currency}</TableCell>
                      <TableCell>{Number(r.surcharge).toFixed(2)}</TableCell>
                      <TableCell>{r.estimated_minutes} min</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "approved" && r.is_active ? "secondary" : "outline"}>
                          {r.is_active ? r.status : "désactivé"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Modifier">
                            <Pencil size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate(r)}>
                            {r.is_active ? "Désactiver" : "Réactiver"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog édition */}
        <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifier le tarif</DialogTitle>
            </DialogHeader>
            {editTarget && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <GeoFieldsRow
                    value={editGeo}
                    onChange={(patch) => setEditGeo({ ...editGeo, ...patch })}
                    levels={["country", "city", "commune", "quartier"]}
                    required={["country", "city"]}
                  />
                </div>
                <div>
                  <Label>Nom de la zone *</Label>
                  <Input value={editForm.zone_name} onChange={(e) => setEditForm({ ...editForm, zone_name: e.target.value })} />
                </div>
                <div>
                  <Label>Devise</Label>
                  <Input value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} />
                </div>
                <div>
                  <Label>Tarif de base *</Label>
                  <Input type="number" step="0.01" min="0" value={editForm.base_price} onChange={(e) => setEditForm({ ...editForm, base_price: e.target.value })} />
                </div>
                <div>
                  <Label>Surcharge</Label>
                  <Input type="number" step="0.01" min="0" value={editForm.surcharge} onChange={(e) => setEditForm({ ...editForm, surcharge: e.target.value })} />
                </div>
                <div>
                  <Label>Prix / km</Label>
                  <Input type="number" step="0.01" min="0" value={editForm.price_per_km} onChange={(e) => setEditForm({ ...editForm, price_per_km: e.target.value })} />
                </div>
                <div>
                  <Label>Délai estimé (min)</Label>
                  <Input type="number" min="1" value={editForm.estimated_minutes} onChange={(e) => setEditForm({ ...editForm, estimated_minutes: e.target.value })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>Annuler</Button>
              <Button onClick={() => updateRate.mutate()} disabled={updateRate.isPending}>
                {updateRate.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}