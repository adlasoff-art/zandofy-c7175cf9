import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, Globe, GripVertical, Pencil, X, Check, ImageIcon } from "lucide-react";
import { compressImage } from "@/utils/image-compress";

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
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const newLogoRef = useRef<HTMLInputElement>(null);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editLogoRef = useRef<HTMLInputElement>(null);

  const loadPlatforms = async () => {
    const { data, error } = await (supabase as any)
      .from("supplier_platforms")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data) setPlatforms(data);
    setLoading(false);
  };

  useEffect(() => { loadPlatforms(); }, []);

  const uploadLogo = async (file: File, prefix: string): Promise<string | null> => {
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop();
    const path = `platforms/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("supplier-images").upload(path, compressed, { cacheControl: "31536000" });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("supplier-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleNewLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewLogoFile(file);
    setNewLogoPreview(URL.createObjectURL(file));
  };

  const addPlatform = async () => {
    if (!newName.trim()) {
      toast({ title: "Erreur", description: "Le nom est requis.", variant: "destructive" });
      return;
    }
    setAdding(true);
    let logoUrl: string | null = null;
    if (newLogoFile) {
      logoUrl = await uploadLogo(newLogoFile, newName.trim().toLowerCase().replace(/\s+/g, "-"));
      if (!logoUrl) {
        toast({ title: "Erreur", description: "Échec upload du logo.", variant: "destructive" });
        setAdding(false);
        return;
      }
    }
    const maxOrder = platforms.length > 0 ? Math.max(...platforms.map(p => p.sort_order)) + 1 : 0;
    const { error } = await (supabase as any)
      .from("supplier_platforms")
      .insert({
        name: newName.trim(),
        logo_url: logoUrl,
        sort_order: maxOrder,
      });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Succès", description: `Plateforme "${newName}" ajoutée.` });
      setNewName("");
      setNewLogoFile(null);
      setNewLogoPreview(null);
      loadPlatforms();
    }
    setAdding(false);
  };

  const startEdit = (p: SupplierPlatform) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditLogoFile(null);
    setEditLogoPreview(p.logo_url);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditLogoFile(null);
    setEditLogoPreview(null);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    const update: any = { name: editName.trim() };
    if (editLogoFile) {
      const url = await uploadLogo(editLogoFile, editName.trim().toLowerCase().replace(/\s+/g, "-"));
      if (url) update.logo_url = url;
    }
    const { error } = await (supabase as any)
      .from("supplier_platforms")
      .update(update)
      .eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Plateforme mise à jour." });
      cancelEdit();
      loadPlatforms();
    }
    setSavingEdit(false);
  };

  const handleEditLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditLogoFile(file);
    setEditLogoPreview(URL.createObjectURL(file));
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Input
              placeholder="Nom (ex: Alibaba)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Logo</label>
              <div className="flex items-center gap-2">
                {newLogoPreview ? (
                  <img src={newLogoPreview} alt="" className="w-8 h-8 object-contain rounded border border-border" />
                ) : (
                  <div className="w-8 h-8 rounded border border-dashed border-border flex items-center justify-center">
                    <ImageIcon size={14} className="text-muted-foreground" />
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => newLogoRef.current?.click()}>
                  {newLogoPreview ? "Changer" : "Uploader"}
                </Button>
                <input ref={newLogoRef} type="file" accept="image/*" className="hidden" onChange={handleNewLogoSelect} />
              </div>
            </div>
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
                {editingId === p.id ? (
                  /* Inline edit mode */
                  <>
                    <div className="flex items-center gap-2 shrink-0">
                      {editLogoPreview ? (
                        <img src={editLogoPreview} alt="" className="w-8 h-8 object-contain rounded border border-border" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <Globe size={16} className="text-muted-foreground" />
                        </div>
                      )}
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => editLogoRef.current?.click()}>
                        Logo
                      </Button>
                      <input ref={editLogoRef} type="file" accept="image/*" className="hidden" onChange={handleEditLogoSelect} />
                    </div>
                    <Input
                      className="flex-1 h-8 text-sm"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => saveEdit(p.id)} disabled={savingEdit} className="h-7 w-7">
                        {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className="text-primary" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-7 w-7">
                        <X size={14} className="text-muted-foreground" />
                      </Button>
                    </div>
                  </>
                ) : (
                  /* Display mode */
                  <>
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
                        onClick={() => startEdit(p)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePlatform(p.id, p.name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
