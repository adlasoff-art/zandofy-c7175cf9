import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, DollarSign, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const defaultServices = [
  { key: "supplier_management", label: "Gestion de fournisseurs" },
  { key: "cod_payment", label: "Paiement à la livraison (COD)" },
  { key: "off_platform_payment", label: "Paiement hors plateforme" },
  { key: "custom_payment_numbers", label: "Numéros de paiement personnalisés" },
  { key: "returns_allowed", label: "Retours autorisés" },
  { key: "auto_margin_calc", label: "Calcul de marge automatique" },
  { key: "vendor_margin", label: "Marge vendeur personnalisée" },
  { key: "coupons", label: "Coupons boutique" },
  { key: "collaborators", label: "Équipes de collaboration" },
  { key: "self_delivery", label: "Self Delivery" },
  { key: "whatsapp_store", label: "WhatsApp boutique" },
];

interface PlanForm {
  service_key: string;
  label: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  is_active: boolean;
}

const emptyForm: PlanForm = { service_key: "", label: "", description: "", price_monthly: 0, price_yearly: 0, is_active: true };

export default function AdminServicePlansPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editDialog, setEditDialog] = useState(false);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["platform-service-plans"],
    queryFn: async () => {
      const { data, error } = await fromTable("platform_service_plans").select("*").order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (plan: PlanForm & { id?: string }) => {
      if (plan.id) {
        const { error } = await fromTable("platform_service_plans").update({
          label: plan.label,
          description: plan.description,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          is_active: plan.is_active,
          updated_at: new Date().toISOString(),
        }).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await fromTable("platform_service_plans").insert({
          service_key: plan.service_key,
          label: plan.label,
          description: plan.description,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          is_active: plan.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Plan sauvegardé" });
      qc.invalidateQueries({ queryKey: ["platform-service-plans"] });
      setEditDialog(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("platform_service_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plan supprimé" });
      qc.invalidateQueries({ queryKey: ["platform-service-plans"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setEditDialog(true);
  };

  const openEdit = (plan: any) => {
    setEditId(plan.id);
    setForm({
      service_key: plan.service_key,
      label: plan.label,
      description: plan.description || "",
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      is_active: plan.is_active,
    });
    setEditDialog(true);
  };

  return (
    <AdminLayout title="Tarification des services" icon={<DollarSign size={20} />}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Gérez les tarifs mensuels/annuels des services payants pour les vendeurs.</p>
          <Button size="sm" onClick={openNew}><Plus size={14} className="mr-1" /> Ajouter un plan</Button>
        </div>

        {/* Quick seed: show suggestions for unregistered services */}
        {plans.length === 0 && !isLoading && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Services suggérés :</p>
            <div className="flex flex-wrap gap-1.5">
              {defaultServices.map((s) => (
                <Button key={s.key} variant="outline" size="sm" onClick={() => {
                  setEditId(null);
                  setForm({ ...emptyForm, service_key: s.key, label: s.label });
                  setEditDialog(true);
                }}>
                  <Plus size={12} className="mr-1" />{s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : (
          <div className="grid gap-3">
            {plans.map((plan: any) => (
              <div key={plan.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{plan.label}</span>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? "Actif" : "Inactif"}</Badge>
                  </div>
                  {plan.description && <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>}
                  <div className="flex gap-4 mt-1 text-xs">
                    <span className="text-primary font-medium">${plan.price_monthly}/mois</span>
                    <span className="text-primary font-medium">${plan.price_yearly}/an</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(plan.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier le plan" : "Nouveau plan de service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!editId && (
              <div>
                <label className="text-sm font-medium">Clé unique</label>
                <Input value={form.service_key} onChange={(e) => setForm({ ...form, service_key: e.target.value })} placeholder="ex: cod_payment" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Libellé</label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Prix mensuel ($)</label>
                <Input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Prix annuel ($)</label>
                <Input type="number" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Actif</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate({ ...form, id: editId || undefined })} disabled={saveMutation.isPending || !form.service_key || !form.label}>
              {saveMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
              <Save size={14} className="mr-1" /> Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
