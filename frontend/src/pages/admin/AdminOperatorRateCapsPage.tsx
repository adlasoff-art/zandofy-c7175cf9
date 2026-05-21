/**
 * AdminOperatorRateCapsPage — Lot 11B Phase B8
 *
 * CRUD des plafonds tarifaires par ville pour les opérateurs de livraison tiers.
 * Les opérateurs plateforme (Very Speed) sont exemptés des plafonds (cf. trigger DB).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GeoFieldsRow } from "@/components/address/GeoFieldsRow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  MapPin,
} from "lucide-react";

type CapRow = {
  id: string;
  country_code: string;
  city: string;
  max_base_price: number;
  max_surcharge: number;
  max_estimated_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  country_code: string;
  city: string;
  max_base_price: string;
  max_surcharge: string;
  max_estimated_minutes: string;
  notes: string;
};

const emptyForm: FormState = {
  country_code: "CD",
  city: "",
  max_base_price: "",
  max_surcharge: "0",
  max_estimated_minutes: "180",
  notes: "",
};

export default function AdminOperatorRateCapsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<CapRow | null>(null);

  const { data: caps, isLoading } = useQuery({
    queryKey: ["admin-operator-rate-caps"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_operator_city_caps")
        .select("*")
        .order("country_code", { ascending: true })
        .order("city", { ascending: true });
      if (error) throw error;
      return (data || []) as CapRow[];
    },
  });

  const filtered = (caps || []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.city.toLowerCase().includes(s) ||
      c.country_code.toLowerCase().includes(s)
    );
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const base = parseFloat(form.max_base_price);
      const surcharge = parseFloat(form.max_surcharge || "0");
      const eta = parseInt(form.max_estimated_minutes, 10);
      if (!form.country_code.trim() || !form.city.trim()) {
        throw new Error("Pays et ville sont obligatoires");
      }
      if (Number.isNaN(base) || base < 0) {
        throw new Error("Prix de base maximum invalide");
      }
      if (Number.isNaN(surcharge) || surcharge < 0) {
        throw new Error("Surcharge maximum invalide");
      }
      if (Number.isNaN(eta) || eta <= 0) {
        throw new Error("ETA maximum invalide");
      }
      const payload = {
        country_code: form.country_code.trim().toUpperCase(),
        city: form.city.trim(),
        max_base_price: base,
        max_surcharge: surcharge,
        max_estimated_minutes: eta,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await (supabase as any)
          .from("delivery_operator_city_caps")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("delivery_operator_city_caps")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Plafond mis à jour" : "Plafond créé");
      qc.invalidateQueries({ queryKey: ["admin-operator-rate-caps"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => {
      const msg = e?.message || "Erreur inconnue";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Un plafond existe déjà pour cette ville");
      } else {
        toast.error(msg);
      }
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("delivery_operator_city_caps")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plafond supprimé");
      qc.invalidateQueries({ queryKey: ["admin-operator-rate-caps"] });
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (c: CapRow) => {
    setForm({
      id: c.id,
      country_code: c.country_code,
      city: c.city,
      max_base_price: String(c.max_base_price),
      max_surcharge: String(c.max_surcharge),
      max_estimated_minutes: String(c.max_estimated_minutes),
      notes: c.notes || "",
    });
    setOpen(true);
  };

  return (
    <AdminLayout title="Plafonds tarifaires livreurs">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert size={20} className="text-primary" />
              Plafonds tarifaires par ville
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Définissez les plafonds maximum (prix de base, surcharge, délai estimé) que
              les opérateurs de livraison tiers peuvent appliquer dans chaque ville. Les
              tarifs au-dessus sont automatiquement refusés. L'opérateur plateforme
              (Very Speed Delivery) est exempté.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus size={16} /> Nouveau plafond
          </Button>
        </div>

        <Input
          placeholder="Rechercher (ville, pays)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {(caps?.length ?? 0) === 0
                ? "Aucun plafond configuré. Sans plafond, les opérateurs peuvent fixer librement leurs tarifs."
                : "Aucun résultat."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((c) => (
              <Card key={c.id} className="hover:border-primary/50 transition">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <MapPin size={14} className="text-muted-foreground" />
                      <h3 className="font-semibold text-foreground">
                        {c.city}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({c.country_code})
                        </span>
                      </h3>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Prix base max :{" "}
                        <strong className="text-foreground">
                          ${Number(c.max_base_price).toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        Surcharge max :{" "}
                        <strong className="text-foreground">
                          ${Number(c.max_surcharge).toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        ETA max :{" "}
                        <strong className="text-foreground">
                          {c.max_estimated_minutes} min
                        </strong>
                      </span>
                    </div>
                    {c.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic">
                        {c.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(c)}
                      className="gap-1"
                    >
                      <Pencil size={14} /> Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDelete(c)}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 size={14} /> Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Modifier le plafond" : "Nouveau plafond"}
            </DialogTitle>
            <DialogDescription>
              Plafond unique par couple (pays, ville). Une seule entrée par ville.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <GeoFieldsRow
              value={{ country: form.country_code, city: form.city }}
              onChange={(patch) =>
                setForm({
                  ...form,
                  country_code: patch.country ?? form.country_code,
                  city: patch.city ?? (patch.country !== undefined ? "" : form.city),
                })
              }
              levels={["country", "city"]}
              required={["country", "city"]}
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="max_base_price">Prix base max ($)</Label>
                <Input
                  id="max_base_price"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.max_base_price}
                  onChange={(e) =>
                    setForm({ ...form, max_base_price: e.target.value })
                  }
                  placeholder="10.00"
                />
              </div>
              <div>
                <Label htmlFor="max_surcharge">Surcharge max ($)</Label>
                <Input
                  id="max_surcharge"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.max_surcharge}
                  onChange={(e) =>
                    setForm({ ...form, max_surcharge: e.target.value })
                  }
                  placeholder="5.00"
                />
              </div>
              <div>
                <Label htmlFor="max_eta">ETA max (min)</Label>
                <Input
                  id="max_eta"
                  type="number"
                  min={1}
                  value={form.max_estimated_minutes}
                  onChange={(e) =>
                    setForm({ ...form, max_estimated_minutes: e.target.value })
                  }
                  placeholder="180"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Justification, contexte concurrentiel…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => upsert.mutate()}
              disabled={upsert.isPending}
              className="gap-1"
            >
              {upsert.isPending && <Loader2 size={14} className="animate-spin" />}
              {form.id ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce plafond ?</DialogTitle>
            <DialogDescription>
              {confirmDelete &&
                `Plafond pour ${confirmDelete.city} (${confirmDelete.country_code}). Les opérateurs pourront ensuite fixer librement leurs tarifs sur cette ville.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
              disabled={remove.isPending}
              className="gap-1"
            >
              {remove.isPending && <Loader2 size={14} className="animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}