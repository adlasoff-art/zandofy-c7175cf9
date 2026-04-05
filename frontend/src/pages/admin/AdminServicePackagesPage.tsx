import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, Pencil, Trash2, Package, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PackageForm {
  name: string;
  slug: string;
  description: string;
  target: string;
  price_monthly: number;
  price_yearly: number;
  included_services: string[];
  max_deliveries_per_day: number;
  max_riders: number;
  hub_storage_free_kg: number;
  withdrawal_delay_days: number;
  trust_threshold_months: number;
  trust_threshold_sales: number;
  visibility_level: string;
  rank: number;
  is_active: boolean;
}

const emptyForm: PackageForm = {
  name: "", slug: "", description: "", target: "vendor",
  price_monthly: 0, price_yearly: 0, included_services: [],
  max_deliveries_per_day: 5, max_riders: 1, hub_storage_free_kg: 0,
  withdrawal_delay_days: 30, trust_threshold_months: 0, trust_threshold_sales: 0,
  visibility_level: "standard", rank: 0, is_active: true,
};

const visibilityOptions = [
  { value: "standard", label: "Standard" },
  { value: "badge_verified", label: "Badge vérifié" },
  { value: "homepage_promo", label: "Accueil & Promo" },
  { value: "dedicated_manager", label: "Gestionnaire dédié" },
];

export default function AdminServicePackagesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editDialog, setEditDialog] = useState(false);
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  // Fetch packages
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["service-packages-admin"],
    queryFn: async () => {
      const { data, error } = await fromTable("service_packages").select("*").order("rank");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch available services for checkboxes
  const { data: availableServices = [] } = useQuery({
    queryKey: ["platform-service-plans-for-packages"],
    queryFn: async () => {
      const { data } = await fromTable("platform_service_plans").select("service_key, label").order("created_at");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (pkg: PackageForm & { id?: string }) => {
      const payload = {
        name: pkg.name, slug: pkg.slug, description: pkg.description, target: pkg.target,
        price_monthly: pkg.price_monthly, price_yearly: pkg.price_yearly,
        included_services: pkg.included_services, max_deliveries_per_day: pkg.max_deliveries_per_day,
        max_riders: pkg.max_riders, hub_storage_free_kg: pkg.hub_storage_free_kg,
        withdrawal_delay_days: pkg.withdrawal_delay_days, trust_threshold_months: pkg.trust_threshold_months,
        trust_threshold_sales: pkg.trust_threshold_sales, visibility_level: pkg.visibility_level,
        rank: pkg.rank, is_active: pkg.is_active, updated_at: new Date().toISOString(),
      };
      if (pkg.id) {
        const { error } = await fromTable("service_packages").update(payload).eq("id", pkg.id);
        if (error) throw error;
      } else {
        const { error } = await fromTable("service_packages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Package sauvegardé" });
      qc.invalidateQueries({ queryKey: ["service-packages-admin"] });
      setEditDialog(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("service_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Package supprimé" });
      qc.invalidateQueries({ queryKey: ["service-packages-admin"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditId(null); setForm(emptyForm); setEditDialog(true); };

  const openEdit = (pkg: any) => {
    setEditId(pkg.id);
    setForm({
      name: pkg.name, slug: pkg.slug, description: pkg.description || "",
      target: pkg.target, price_monthly: pkg.price_monthly, price_yearly: pkg.price_yearly,
      included_services: pkg.included_services || [],
      max_deliveries_per_day: pkg.max_deliveries_per_day, max_riders: pkg.max_riders,
      hub_storage_free_kg: pkg.hub_storage_free_kg, withdrawal_delay_days: pkg.withdrawal_delay_days,
      trust_threshold_months: pkg.trust_threshold_months ?? 0,
      trust_threshold_sales: pkg.trust_threshold_sales ?? 0,
      visibility_level: pkg.visibility_level, rank: pkg.rank, is_active: pkg.is_active,
    });
    setEditDialog(true);
  };

  const toggleService = (key: string) => {
    setForm(prev => ({
      ...prev,
      included_services: prev.included_services.includes(key)
        ? prev.included_services.filter(s => s !== key)
        : [...prev.included_services, key],
    }));
  };

  return (
    <AdminLayout title="Packages de services">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Composez des packs regroupant services, logistique et règles financières.</p>
          <Button size="sm" onClick={openNew}><Plus size={14} className="mr-1" /> Nouveau package</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : packages.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <Package size={40} className="mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun package créé.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {packages.map((pkg: any) => (
              <div key={pkg.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{pkg.name}</span>
                      <Badge variant={pkg.is_active ? "default" : "secondary"}>{pkg.is_active ? "Actif" : "Inactif"}</Badge>
                      <Badge variant="outline" className="text-[10px]">{pkg.target === "vendor" ? "Vendeur" : "Client"}</Badge>
                      <Badge variant="outline" className="text-[10px]">Rang {pkg.rank}</Badge>
                    </div>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs">
                      <span className="text-primary font-medium">${pkg.price_monthly}/mois</span>
                      <span className="text-primary font-medium">${pkg.price_yearly}/an</span>
                      <span>{pkg.max_deliveries_per_day} courses/jour</span>
                      <span>{pkg.max_riders} livreurs</span>
                      <span>Hub: {pkg.hub_storage_free_kg > 0 ? `${pkg.hub_storage_free_kg} kg gratuit` : "Payant"}</span>
                      <span>Retrait: {pkg.withdrawal_delay_days}j</span>
                    </div>
                    {pkg.included_services?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {pkg.included_services.map((s: string) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(pkg)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(pkg.id)}><Trash2 size={14} /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier le package" : "Nouveau package"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Nom</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pro" />
              </div>
              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="ex: pro" disabled={!!editId} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Cible</label>
                <Select value={form.target} onValueChange={v => setForm({ ...form, target: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendeur</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Rang (hiérarchie)</label>
                <Input type="number" value={form.rank} onChange={e => setForm({ ...form, rank: Number(e.target.value) })} />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Prix mensuel ($)</label>
                <Input type="number" step="0.01" value={form.price_monthly} onChange={e => setForm({ ...form, price_monthly: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Prix annuel ($)</label>
                <Input type="number" step="0.01" value={form.price_yearly} onChange={e => setForm({ ...form, price_yearly: Number(e.target.value) })} />
              </div>
            </div>

            {/* Services */}
            <div>
              <label className="text-sm font-medium mb-2 block">Services inclus</label>
              {availableServices.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun service défini dans Plans de services.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableServices.map((s: any) => {
                    const checked = form.included_services.includes(s.service_key);
                    return (
                      <button
                        key={s.service_key}
                        type="button"
                        onClick={() => toggleService(s.service_key)}
                        className={`flex items-center gap-2 text-left text-xs px-3 py-2 rounded-md border transition-colors ${
                          checked ? "bg-primary/10 border-primary text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/30"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                          {checked && <Check size={10} className="text-primary-foreground" />}
                        </div>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logistics */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Courses/jour max</label>
                <Input type="number" value={form.max_deliveries_per_day} onChange={e => setForm({ ...form, max_deliveries_per_day: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Livreurs max</label>
                <Input type="number" value={form.max_riders} onChange={e => setForm({ ...form, max_riders: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Hub gratuit (kg)</label>
                <Input type="number" value={form.hub_storage_free_kg} onChange={e => setForm({ ...form, hub_storage_free_kg: Number(e.target.value) })} />
              </div>
            </div>

            {/* Trust & Withdrawal */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Délai retrait (jours)</label>
                <Input type="number" value={form.withdrawal_delay_days} onChange={e => setForm({ ...form, withdrawal_delay_days: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Seuil confiance (mois)</label>
                <Input type="number" value={form.trust_threshold_months} onChange={e => setForm({ ...form, trust_threshold_months: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Seuil ventes ($)</label>
                <Input type="number" value={form.trust_threshold_sales} onChange={e => setForm({ ...form, trust_threshold_sales: Number(e.target.value) })} />
              </div>
            </div>

            {/* Visibility */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Niveau de visibilité</label>
                <Select value={form.visibility_level} onValueChange={v => setForm({ ...form, visibility_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {visibilityOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                <span className="text-sm">Actif</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate({ ...form, id: editId || undefined })} disabled={saveMutation.isPending || !form.name || !form.slug}>
              {saveMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
              <Save size={14} className="mr-1" /> Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
