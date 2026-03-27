import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, Globe, GripVertical } from "lucide-react";

interface SupplierPlatform {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export default function AdminSupplierPlatformsPage() {
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<SupplierPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const loadPlatforms = async () => {
    const { data, error } = await (supabase as any)
      .from("supplier_platforms")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data) setPlatforms(data);
    setLoading(false);
  };

  useEffect(() => { loadPlatforms(); }, []);

  const addPlatform = async () => {
    if (!newName.trim()) {
      toast({ title: "Erreur", description: "Le nom est requis.", variant: "destructive" });
      return;
    }
    setAdding(true);
    const maxOrder = platforms.length > 0 ? Math.max(...platforms.map(p => p.sort_order)) + 1 : 0;
    const { error } = await (supabase as any)
      .from("supplier_platforms")
      .insert({
        name: newName.trim(),
        logo_url: newLogoUrl.trim() || null,
        sort_order: maxOrder,
      });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Succès", description: `Plateforme "${newName}" ajoutée.` });
      setNewName("");
      setNewLogoUrl("");
      loadPlatforms();
    }
    setAdding(false);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await (supabase as any)
      .from("supplier_platforms")
      .update({ is_active: !isActive })
      .eq("id", id);
    if (!error) {
      setPlatforms(prev => prev.map(p => p.id === id ? { ...p, is_active: !isActive } : p));
    }
  };

  const deletePlatform = async (id: string, name: string) => {
    if (!confirm(`Supprimer "${name}" ? Cette action est irréversible.`)) return;
    const { error } = await (supabase as any)
      .from("supplier_platforms")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Supprimée", description: `Plateforme "${name}" supprimée.` });
      setPlatforms(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <AdminLayout title="Plateformes fournisseurs">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plateformes fournisseurs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les plateformes d'approvisionnement disponibles pour les commandes (Alibaba, AliExpress, Shein, etc.)
          </p>
        </div>

        {/* Add new platform */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus size={16} className="text-primary" /> Ajouter une plateforme
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Nom (ex: Alibaba)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <Input
              placeholder="URL du logo (optionnel)"
              value={newLogoUrl}
              onChange={e => setNewLogoUrl(e.target.value)}
            />
            <Button onClick={addPlatform} disabled={adding} className="gap-2">
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="animate-spin mx-auto text-primary" size={24} />
            </div>
          ) : platforms.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Aucune plateforme configurée.
            </div>
          ) : (
            platforms.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                <GripVertical size={16} className="text-muted-foreground shrink-0" />
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} className="w-6 h-6 object-contain rounded" />
                  ) : (
                    <Globe size={16} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Ajouté le {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{p.is_active ? "Actif" : "Inactif"}</span>
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={() => toggleActive(p.id, p.is_active)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePlatform(p.id, p.name)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
