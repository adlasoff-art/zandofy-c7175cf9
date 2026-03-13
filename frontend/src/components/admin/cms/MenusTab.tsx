import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Eye, EyeOff, GripVertical, Save, X, Loader2 } from "lucide-react";

export default function MenusTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ label: "", url: "/", is_visible: true, menu_group: "main" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("cms_menu_items").select("*").order("sort_order");
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.label.trim()) return;
    if (editing) {
      await supabase.from("cms_menu_items").update(form).eq("id", editing.id);
      toast({ title: "Menu mis à jour" });
    } else {
      await supabase.from("cms_menu_items").insert({ ...form, sort_order: items.length });
      toast({ title: "Élément ajouté" });
    }
    setEditing(null);
    setForm({ label: "", url: "/", is_visible: true, menu_group: "main" });
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cms_menu_items").delete().eq("id", id);
    toast({ title: "Élément supprimé" });
    load();
  };

  const handleToggle = async (id: string, visible: boolean) => {
    await supabase.from("cms_menu_items").update({ is_visible: !visible }).eq("id", id);
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{editing ? "Modifier l'élément" : "Ajouter un élément"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Accueil" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="/" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Groupe</Label>
            <Input value={form.menu_group} onChange={(e) => setForm((f) => ({ ...f, menu_group: e.target.value }))} placeholder="main" className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} className="gap-1.5"><Save size={14} /> {editing ? "Mettre à jour" : "Ajouter"}</Button>
          {editing && <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setForm({ label: "", url: "/", is_visible: true, menu_group: "main" }); }}><X size={14} /> Annuler</Button>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Navigation ({items.length})</h3>
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <GripVertical size={16} className="text-muted-foreground/40 cursor-grab" />
              <span className="text-sm text-foreground flex-1">{m.label}</span>
              <span className="text-xs text-muted-foreground font-mono">{m.url}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m.menu_group}</span>
              <button onClick={() => handleToggle(m.id, m.is_visible)} className={`p-1 rounded ${m.is_visible ? "text-primary" : "text-muted-foreground"}`}>
                {m.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button onClick={() => { setEditing(m); setForm({ label: m.label, url: m.url, is_visible: m.is_visible, menu_group: m.menu_group }); }} className="p-1 rounded text-muted-foreground hover:bg-muted">
                <Edit2 size={14} />
              </button>
              <button onClick={() => handleDelete(m.id)} className="p-1 rounded text-destructive hover:bg-destructive/10">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun élément de menu</p>}
        </div>
      </div>
    </div>
  );
}
