/**
 * EditOperatorDialog — Édition admin d'un opérateur (admin-update-operator EF).
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type OperatorLike = {
  id: string;
  company_name: string;
  legal_name: string | null;
  registration_number: string | null;
  tax_id: string | null;
  contact_email: string;
  contact_phone: string;
  headquarters_city: string;
  headquarters_country: string;
  platform_commission_pct: number;
  max_riders: number;
  is_active: boolean;
};

export function EditOperatorDialog({
  operator,
  open,
  onOpenChange,
}: {
  operator: OperatorLike | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<OperatorLike>>({});

  useEffect(() => {
    if (operator) setForm({ ...operator });
  }, [operator]);

  const update = useMutation({
    mutationFn: async () => {
      if (!operator) throw new Error("No operator");
      const patch: Record<string, unknown> = {};
      const fields: (keyof OperatorLike)[] = [
        "company_name", "legal_name", "registration_number", "tax_id",
        "contact_email", "contact_phone", "headquarters_city", "headquarters_country",
        "platform_commission_pct", "max_riders", "is_active",
      ];
      fields.forEach((f) => {
        if (form[f] !== operator[f]) patch[f] = form[f];
      });
      if (Object.keys(patch).length === 0) {
        throw new Error("Aucun changement à enregistrer");
      }
      const { data, error } = await supabase.functions.invoke("admin-update-operator", {
        body: { operator_id: operator.id, patch },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Opérateur mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-operators"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!operator) return null;

  const set = <K extends keyof OperatorLike>(k: K, v: OperatorLike[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Éditer {operator.company_name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><Label>Nom commercial</Label><Input value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} /></div>
          <div><Label>Raison sociale</Label><Input value={form.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} /></div>
          <div><Label>RCCM</Label><Input value={form.registration_number ?? ""} onChange={(e) => set("registration_number", e.target.value)} /></div>
          <div><Label>NIF / Tax ID</Label><Input value={form.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} /></div>
          <div><Label>Email contact</Label><Input type="email" value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} /></div>
          <div><Label>Téléphone</Label><Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></div>
          <div><Label>Ville siège</Label><Input value={form.headquarters_city ?? ""} onChange={(e) => set("headquarters_city", e.target.value)} /></div>
          <div><Label>Pays siège (ISO)</Label><Input value={form.headquarters_country ?? ""} onChange={(e) => set("headquarters_country", e.target.value)} /></div>
          <div><Label>Commission plateforme (%)</Label><Input type="number" step="0.01" min={0} max={50} value={String(form.platform_commission_pct ?? 0)} onChange={(e) => set("platform_commission_pct", parseFloat(e.target.value) || 0)} /></div>
          <div><Label>Quota livreurs</Label><Input type="number" min={1} value={String(form.max_riders ?? 1)} onChange={(e) => set("max_riders", parseInt(e.target.value) || 1)} /></div>
          <div className="flex items-center justify-between border border-border rounded-md p-3 md:col-span-2">
            <div>
              <Label>Actif</Label>
              <p className="text-xs text-muted-foreground">Désactiver retire l'opérateur du checkout sans archiver.</p>
            </div>
            <Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => update.mutate()} disabled={update.isPending}>
            {update.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}