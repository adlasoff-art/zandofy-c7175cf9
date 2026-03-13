import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Plus, Edit2, Trash2, ChevronRight, Loader2, X, Save, Upload, Image } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  name_fr: string;
  icon: string | null;
  image_url: string | null;
  parent_id: string | null;
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
}

const emptyForm: FormState = { mode: "add", name: "", name_fr: "", icon: "", image_url: "", display_mode: "icon", parent_id: "" };

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name_fr");
      return (data ?? []) as Category[];
    },
  });

  const tree = buildTree(categories);

  // Flatten for parent select
  const parentOptions = categories.filter((c) => !c.parent_id || !categories.find((p) => p.id === c.parent_id)?.parent_id);

  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        name: f.name,
        name_fr: f.name_fr,
        icon: f.icon || null,
        parent_id: f.parent_id || null,
      };
      if (f.mode === "edit" && f.id) {
        const { error } = await supabase.from("categories").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
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
    setForm({ mode: "edit", id: cat.id, name: cat.name, name_fr: cat.name_fr, icon: cat.icon || "", parent_id: cat.parent_id || "" });
    setShowForm(true);
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
              <label className="text-xs text-muted-foreground block mb-1">Icône (emoji)</label>
              <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="📱"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
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
          {tree.map((cat) => (
            <div key={cat.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-border/50">
                <span className="text-lg">{cat.icon || "📁"}</span>
                <span className="text-sm font-semibold text-foreground flex-1">{cat.name_fr}</span>
                <span className="text-xs text-muted-foreground">{cat.children.length} sous-cat.</span>
                <button onClick={() => openAdd(cat.id)} className="p-1 text-primary hover:text-primary/80" title="Ajouter sous-catégorie"><Plus size={14} /></button>
                <button onClick={() => openEdit(cat)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                <button onClick={() => setDeleteId(cat.id)} className="p-1 text-destructive hover:text-destructive/80"><Trash2 size={14} /></button>
              </div>
              {cat.children.map((sub) => (
                <div key={sub.id}>
                  <div className="flex items-center gap-3 px-4 py-2.5 pl-10 border-b border-border/30 bg-muted/20">
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
