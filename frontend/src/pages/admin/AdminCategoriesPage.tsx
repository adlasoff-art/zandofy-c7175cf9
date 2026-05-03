import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Plus, Edit2, Trash2, ChevronRight, ChevronUp, ChevronDown, Loader2, X, Save, Upload, Image, GripVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { slugify } from "@/utils/slugify";

interface Category {
  id: string;
  name: string;
  name_fr: string;
  icon: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
}

interface TreeNode extends Category {
  children: TreeNode[];
}

function buildTree(cats: Category[]): TreeNode[] {
  const map: Record<string, TreeNode> = {};
  cats.forEach((c) => { map[c.id] = { ...c, children: [] }; });
  const roots: TreeNode[] = [];
  cats.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].children.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });
  // Sort by sort_order
  roots.sort((a, b) => a.sort_order - b.sort_order);
  roots.forEach(r => r.children.sort((a, b) => a.sort_order - b.sort_order));
  return roots;
}

interface FormState {
  mode: "add" | "edit";
  id?: string;
  name: string;
  name_fr: string;
  icon: string;
  image_url: string;
  display_mode: string;
  parent_id: string;
  sort_order: number;
}

const emptyForm: FormState = { mode: "add", name: "", name_fr: "", icon: "", image_url: "", display_mode: "icon", parent_id: "", sort_order: 0 };

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Category-level pricing override state (loaded when editing an existing category)
  const [pricingOverride, setPricingOverride] = useState<{
    enabled: boolean;
    margin_pct: string;
    multiplier: string;
    description: string;
    inherit_to_children: boolean;
    existingId: string | null;
    loading: boolean;
    saving: boolean;
  }>({ enabled: false, margin_pct: "", multiplier: "", description: "", inherit_to_children: true, existingId: null, loading: false, saving: false });

  useEffect(() => {
    if (!showForm || form.mode !== "edit" || !form.id) {
      setPricingOverride({ enabled: false, margin_pct: "", multiplier: "", description: "", inherit_to_children: true, existingId: null, loading: false, saving: false });
      return;
    }
    setPricingOverride((p) => ({ ...p, loading: true }));
    (supabase as any)
      .from("category_pricing_overrides")
      .select("id, margin_pct, multiplier, description, inherit_to_children, active")
      .eq("category_id", form.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setPricingOverride({
            enabled: !!data.active,
            margin_pct: data.margin_pct != null ? String(data.margin_pct) : "",
            multiplier: data.multiplier != null ? String(data.multiplier) : "",
            description: data.description ?? "",
            inherit_to_children: data.inherit_to_children ?? true,
            existingId: data.id,
            loading: false,
            saving: false,
          });
        } else {
          setPricingOverride({ enabled: false, margin_pct: "", multiplier: "", description: "", inherit_to_children: true, existingId: null, loading: false, saving: false });
        }
      });
  }, [showForm, form.mode, form.id]);

  const savePricingOverride = async () => {
    if (!form.id) return;
    setPricingOverride((p) => ({ ...p, saving: true }));
    const payload: any = {
      category_id: form.id,
      margin_pct: pricingOverride.margin_pct ? Number(pricingOverride.margin_pct) : null,
      multiplier: pricingOverride.multiplier ? Number(pricingOverride.multiplier) : null,
      description: pricingOverride.description || null,
      inherit_to_children: pricingOverride.inherit_to_children,
      active: pricingOverride.enabled,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (pricingOverride.existingId) {
      const res = await (supabase as any).from("category_pricing_overrides").update(payload).eq("id", pricingOverride.existingId);
      error = res.error;
    } else {
      const res = await (supabase as any).from("category_pricing_overrides").insert(payload);
      error = res.error;
    }
    setPricingOverride((p) => ({ ...p, saving: false }));
    if (error) toast.error(error.message);
    else toast.success("Tarification de la catégorie enregistrée");
  };

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("categories").select("*").order("sort_order").order("name_fr");
      return (data ?? []) as Category[];
    },
  });

  const tree = buildTree(categories);

  // Flatten for parent select
  const parentOptions = categories.filter((c) => !c.parent_id || !categories.find((p) => p.id === c.parent_id)?.parent_id);

  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const payload: any = {
        name: f.name,
        name_fr: f.name_fr,
        icon: f.icon || null,
        image_url: f.image_url || null,
        display_mode: f.display_mode || "icon",
        parent_id: f.parent_id || null,
        sort_order: f.sort_order,
      };
      if (f.mode === "edit" && f.id) {
        const { error } = await (supabase as any).from("categories").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setShowForm(false);
      setForm(emptyForm);
      toast.success(form.mode === "edit" ? "Catégorie modifiée" : "Catégorie ajoutée");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setDeleteId(null);
      toast.success("Catégorie supprimée");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const openEdit = (cat: Category) => {
    setForm({ mode: "edit", id: cat.id, name: cat.name, name_fr: cat.name_fr, icon: cat.icon || "", image_url: cat.image_url || "", display_mode: (cat as any).display_mode || "icon", parent_id: cat.parent_id || "", sort_order: cat.sort_order ?? 0 });
    setShowForm(true);
  };

  const moveMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: string; newOrder: number }) => {
      const { error } = await (supabase as any).from("categories").update({ sort_order: newOrder }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  const moveCategory = (catId: string, siblings: Category[], direction: "up" | "down") => {
    const idx = siblings.findIndex(c => c.id === catId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const currentOrder = siblings[idx].sort_order;
    const swapOrder = siblings[swapIdx].sort_order;
    // If they have the same sort_order, use index-based values
    const newCurrent = swapOrder === currentOrder ? (direction === "up" ? currentOrder - 1 : currentOrder + 1) : swapOrder;
    const newSwap = swapOrder === currentOrder ? currentOrder : currentOrder;
    moveMutation.mutate({ id: siblings[idx].id, newOrder: newCurrent });
    moveMutation.mutate({ id: siblings[swapIdx].id, newOrder: newSwap });
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "webp";
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
    const safeName = slugify(nameWithoutExt) || "image";
    const path = `categories/${Date.now()}_${safeName}.${ext}`;
    const { error } = await supabase.storage.from("cms-assets").upload(path, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("cms-assets").getPublicUrl(path);
    setForm(f => ({ ...f, image_url: urlData.publicUrl }));
    setUploading(false);
  };

  const openAdd = (parentId?: string) => {
    setForm({ ...emptyForm, parent_id: parentId || "" });
    setShowForm(true);
  };

  return (
    <AdminLayout title="Gestion des catégories">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{categories.length} catégorie(s)</p>
        <button onClick={() => openAdd()} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {form.mode === "edit" ? "Modifier la catégorie" : "Nouvelle catégorie"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nom (FR)</label>
              <input value={form.name_fr} onChange={(e) => setForm((f) => ({ ...f, name_fr: e.target.value }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nom (EN)</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Mode d'affichage</label>
              <div className="flex gap-2">
                <button onClick={() => setForm(f => ({ ...f, display_mode: "icon" }))} className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${form.display_mode === "icon" ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-foreground hover:border-primary/50"}`}>
                  Icône
                </button>
                <button onClick={() => setForm(f => ({ ...f, display_mode: "image" }))} className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${form.display_mode === "image" ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-foreground hover:border-primary/50"}`}>
                  Image
                </button>
              </div>
            </div>
            {form.display_mode === "icon" ? (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Icône (emoji)</label>
                <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="📱"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            ) : (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Image de catégorie</label>
                {form.image_url && (
                  <div className="w-full h-20 rounded-lg overflow-hidden mb-2 bg-muted">
                    <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer text-sm text-muted-foreground hover:bg-muted/80 w-fit">
                  <Upload size={14} />
                  {uploading ? "Upload..." : "Choisir une image"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} disabled={uploading} />
                </label>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Catégorie parente</label>
              <select value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">— Racine —</option>
                {parentOptions.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
              </select>
            </div>
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name || !form.name_fr || saveMutation.isPending}
              className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {form.mode === "edit" ? "Enregistrer" : "Ajouter"}
            </button>

            {form.mode === "edit" && form.id && (
              <div className="border-t border-border pt-4 mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Tarification spécifique (optionnel)</p>
                    <p className="text-[10px] text-muted-foreground">Surcharge la marge / le multiplicateur global pour les produits de cette catégorie.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={pricingOverride.enabled}
                    onChange={(e) => setPricingOverride((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                </div>
                {pricingOverride.enabled && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Marge (%) — vide = global</label>
                        <input type="number" min={0} step={0.5} value={pricingOverride.margin_pct} onChange={(e) => setPricingOverride((p) => ({ ...p, margin_pct: e.target.value }))} placeholder="ex: 12" className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-md" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Multiplicateur fixe — vide = tranches</label>
                        <input type="number" min={0} step={0.1} value={pricingOverride.multiplier} onChange={(e) => setPricingOverride((p) => ({ ...p, multiplier: e.target.value }))} placeholder="ex: 2" className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-md" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Description (visible vendeurs)</label>
                      <input type="text" value={pricingOverride.description} onChange={(e) => setPricingOverride((p) => ({ ...p, description: e.target.value }))} placeholder="ex: Marge réduite 12% — high-tech compétitif" className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-md" />
                    </div>
                    <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <input type="checkbox" checked={pricingOverride.inherit_to_children} onChange={(e) => setPricingOverride((p) => ({ ...p, inherit_to_children: e.target.checked }))} />
                      Hériter aux sous-catégories
                    </label>
                  </div>
                )}
                <button
                  onClick={savePricingOverride}
                  disabled={pricingOverride.saving || pricingOverride.loading}
                  className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted flex items-center gap-1 disabled:opacity-50"
                >
                  {pricingOverride.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Enregistrer la tarification
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-foreground font-medium">Supprimer cette catégorie et ses sous-catégories ?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50">
                {deleteMutation.isPending ? "..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : tree.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Aucune catégorie. Cliquez sur "Ajouter" pour commencer.</p>
      ) : (
        <div className="space-y-3">
          {tree.map((cat, catIdx) => (
            <div key={cat.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-border/50">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveCategory(cat.id, tree, "up")} disabled={catIdx === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp size={12} /></button>
                  <button onClick={() => moveCategory(cat.id, tree, "down")} disabled={catIdx === tree.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown size={12} /></button>
                </div>
                <span className="text-lg">{cat.icon || "📁"}</span>
                <span className="text-sm font-semibold text-foreground flex-1">{cat.name_fr}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{catIdx + 1}</span>
                <span className="text-xs text-muted-foreground">{cat.children.length} sous-cat.</span>
                <button onClick={() => openAdd(cat.id)} className="p-1 text-primary hover:text-primary/80" title="Ajouter sous-catégorie"><Plus size={14} /></button>
                <button onClick={() => openEdit(cat)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                <button onClick={() => setDeleteId(cat.id)} className="p-1 text-destructive hover:text-destructive/80"><Trash2 size={14} /></button>
              </div>
              {cat.children.map((sub, subIdx) => (
                <div key={sub.id}>
                  <div className="flex items-center gap-2 px-4 py-2.5 pl-8 border-b border-border/30 bg-muted/20">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveCategory(sub.id, cat.children, "up")} disabled={subIdx === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp size={10} /></button>
                      <button onClick={() => moveCategory(sub.id, cat.children, "down")} disabled={subIdx === cat.children.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown size={10} /></button>
                    </div>
                    <ChevronRight size={12} className="text-muted-foreground" />
                    <span className="text-sm text-foreground flex-1">{sub.name_fr}</span>
                    {sub.children.length > 0 && <span className="text-[10px] text-muted-foreground">{sub.children.length}</span>}
                    <button onClick={() => openAdd(sub.id)} className="p-1 text-primary hover:text-primary/80"><Plus size={12} /></button>
                    <button onClick={() => openEdit(sub)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 size={12} /></button>
                    <button onClick={() => setDeleteId(sub.id)} className="p-1 text-destructive hover:text-destructive/80"><Trash2 size={12} /></button>
                  </div>
                  {sub.children.map((leaf) => (
                    <div key={leaf.id} className="flex items-center gap-3 px-4 py-2 pl-16 border-b border-border/20 bg-muted/10">
                      <span className="text-xs text-muted-foreground flex-1">{leaf.name_fr}</span>
                      <button onClick={() => openEdit(leaf)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 size={11} /></button>
                      <button onClick={() => setDeleteId(leaf.id)} className="p-1 text-destructive hover:text-destructive/80"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
