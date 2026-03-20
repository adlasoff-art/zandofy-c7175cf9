import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Loader2, GripVertical, Save, X } from "lucide-react";
import { toast } from "sonner";

interface TrendTag {
  id: string;
  name: string;
  name_fr: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export function TrendTagsTab() {
  const [tags, setTags] = useState<TrendTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TrendTag | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", name_fr: "", slug: "", sort_order: 0, is_active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("trend_tags").select("*").order("sort_order");
    setTags(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm({ name: "", name_fr: "", slug: "", sort_order: tags.length, is_active: true });
  };

  const openEdit = (tag: TrendTag) => {
    setCreating(false);
    setEditing(tag);
    setForm({
      name: tag.name,
      name_fr: tag.name_fr,
      slug: tag.slug,
      sort_order: tag.sort_order,
      is_active: tag.is_active,
    });
  };

  const cancel = () => { setCreating(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.name_fr.trim() || !form.slug.trim()) {
      toast.error("Nom FR et slug obligatoires");
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name || form.name_fr,
      name_fr: form.name_fr,
      slug: form.slug.toLowerCase().replace(/\s+/g, "-"),
      sort_order: form.sort_order,
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await (supabase as any).from("trend_tags").update(payload).eq("id", editing.id);
      if (error) toast.error("Erreur: " + error.message);
      else toast.success("Tag mis à jour");
    } else {
      const { error } = await (supabase as any).from("trend_tags").insert(payload);
      if (error) toast.error("Erreur: " + error.message);
      else toast.success("Tag créé");
    }

    setSaving(false);
    cancel();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce tag ?")) return;
    await (supabase as any).from("trend_tags").delete().eq("id", id);
    toast.success("Tag supprimé");
    load();
  };

  const toggleActive = async (tag: TrendTag) => {
    await (supabase as any).from("trend_tags").update({ is_active: !tag.is_active }).eq("id", tag.id);
    toast.success(tag.is_active ? "Désactivé" : "Activé");
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Tags Tendance</h3>
        <button onClick={openCreate} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Les tags Tendance apparaissent comme filtres dans la section « Tendances » de la page d'accueil. 
        Les vendeurs peuvent associer un tag à chaque produit.
      </p>

      {/* Create/Edit form */}
      {(creating || editing) && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold">{editing ? "Modifier" : "Nouveau"} tag</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nom FR *</label>
              <input className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card" value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nom EN</label>
              <input className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Slug *</label>
              <input className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ordre</label>
              <input type="number" className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Actif
          </label>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editing ? "Mettre à jour" : "Créer"}
            </button>
            <button onClick={cancel} className="flex items-center gap-1 text-xs bg-muted text-foreground px-3 py-1.5 rounded-md">
              <X size={14} /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* Tags list */}
      <div className="space-y-1">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center justify-between bg-card border border-border rounded-md px-3 py-2">
            <div className="flex items-center gap-3">
              <GripVertical size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">{tag.name_fr}</span>
              <span className="text-xs text-muted-foreground">({tag.slug})</span>
              {!tag.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">Inactif</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleActive(tag)} className={`text-xs px-2 py-1 rounded ${tag.is_active ? "text-orange-600" : "text-emerald-600"}`}>
                {tag.is_active ? "Désactiver" : "Activer"}
              </button>
              <button onClick={() => openEdit(tag)} className="p-1 text-muted-foreground hover:text-foreground">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(tag.id)} className="p-1 text-muted-foreground hover:text-destructive">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {tags.length === 0 && !creating && (
        <p className="text-center text-xs text-muted-foreground py-4">Aucun tag de tendance configuré</p>
      )}
    </div>
  );
}
