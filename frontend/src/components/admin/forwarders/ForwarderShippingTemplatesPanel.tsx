/**
 * ForwarderShippingTemplatesPanel — Admin only.
 * CRUD des modèles d'expédition d'un transitaire (forwarder_shipping_templates).
 * RLS : insert/update/delete réservés admin/manager.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Warehouse, Save } from "lucide-react";

interface Template {
  id: string;
  forwarder_id: string;
  label: string;
  warehouse_address: string;
  package_info_template: string;
  is_default: boolean;
  sort_order: number;
}

const DEFAULT_TPL = `{{customer_name}}
Tel: {{phone}}
{{city}}, {{country}}
Ref: {{order_ref}}`;

export function ForwarderShippingTemplatesPanel({ forwarderId }: { forwarderId: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Template[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("forwarder_shipping_templates")
      .select("id, forwarder_id, label, warehouse_address, package_info_template, is_default, sort_order")
      .eq("forwarder_id", forwarderId)
      .order("sort_order", { ascending: true });
    if (error) toast.error("Chargement impossible : " + error.message);
    setRows((data ?? []) as Template[]);
    setLoading(false);
  };

  useEffect(() => {
    if (forwarderId) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwarderId]);

  const addRow = async () => {
    const { data, error } = await (supabase as any)
      .from("forwarder_shipping_templates")
      .insert({
        forwarder_id: forwarderId,
        label: "Nouvel entrepôt",
        warehouse_address: "",
        package_info_template: DEFAULT_TPL,
        is_default: rows.length === 0,
        sort_order: rows.length,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erreur création : " + error.message);
      return;
    }
    setRows((prev) => [...prev, data as Template]);
  };

  const updateLocal = (id: string, patch: Partial<Template>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveRow = async (row: Template) => {
    setSavingId(row.id);
    const { error } = await (supabase as any)
      .from("forwarder_shipping_templates")
      .update({
        label: row.label,
        warehouse_address: row.warehouse_address,
        package_info_template: row.package_info_template,
        is_default: row.is_default,
        sort_order: row.sort_order,
      })
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast.error("Sauvegarde échouée : " + error.message);
      return;
    }
    toast.success("Modèle enregistré");
    if (row.is_default) await reload(); // reflète l'unicité du défaut
  };

  const removeRow = async (id: string) => {
    if (!confirm("Supprimer ce modèle ?")) return;
    const { error } = await (supabase as any)
      .from("forwarder_shipping_templates")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Suppression échouée : " + error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3 p-3 border border-border rounded-lg bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-sm flex items-center gap-1.5">
          <Warehouse size={13} className="text-primary" /> Modèles d'expédition (entrepôts)
        </Label>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <Plus size={13} className="mr-1" /> Ajouter
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Visibles uniquement par les vendeurs et admins. Le client final ne voit jamais ces adresses.
        Variables disponibles dans le gabarit infos colis :{" "}
        <code className="text-[10px]">{"{{customer_name}}"}</code>,{" "}
        <code className="text-[10px]">{"{{phone}}"}</code>,{" "}
        <code className="text-[10px]">{"{{city}}"}</code>,{" "}
        <code className="text-[10px]">{"{{country}}"}</code>,{" "}
        <code className="text-[10px]">{"{{order_ref}}"}</code>.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Aucun modèle. Cliquez sur Ajouter.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 text-sm"
                  value={row.label}
                  placeholder="Libellé (ex : Entrepôt Guangzhou)"
                  onChange={(e) => updateLocal(row.id, { label: e.target.value })}
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <Label className="text-[11px]">Défaut</Label>
                  <Switch
                    checked={row.is_default}
                    onCheckedChange={(v) => updateLocal(row.id, { is_default: v })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Adresse entrepôt</Label>
                <Textarea
                  rows={3}
                  className="text-xs font-mono"
                  value={row.warehouse_address}
                  onChange={(e) => updateLocal(row.id, { warehouse_address: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[11px]">Gabarit infos colis</Label>
                <Textarea
                  rows={4}
                  className="text-xs font-mono"
                  value={row.package_info_template}
                  onChange={(e) => updateLocal(row.id, { package_info_template: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 size={12} className="mr-1" /> Supprimer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveRow(row)}
                  disabled={savingId === row.id}
                >
                  {savingId === row.id ? (
                    <Loader2 size={12} className="animate-spin mr-1" />
                  ) : (
                    <Save size={12} className="mr-1" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}