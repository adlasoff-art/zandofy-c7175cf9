import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Edit2, Trash2, Eye, EyeOff, Save, X, Loader2 } from "lucide-react";

export default function PagesTab() {
  const { toast } = useToast();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ slug: "", title: "", content: "", is_published: false });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("cms_pages").select("*").order("created_at", { ascending: false });
    setPages(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.slug.trim() || !form.title.trim()) return;
    if (editing) {
      await supabase.from("cms_pages").update(form).eq("id", editing.id);
      toast({ title: "Page mise à jour" });
    } else {
      await supabase.from("cms_pages").insert(form);
      toast({ title: "Page créée" });
    }
    setEditing(null);
    setForm({ slug: "", title: "", content: "", is_published: false });
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cms_pages").delete().eq("id", id);
    toast({ title: "Page supprimée" });
    load();
  };

  const handleToggle = async (id: string, published: boolean) => {
    await supabase.from("cms_pages").update({ is_published: !published }).eq("id", id);
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{editing ? "Modifier la page" : "Créer une page"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="a-propos" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Titre</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="À propos" className="h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Contenu</Label>
          <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Contenu de la page..." rows={6} className="text-sm" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={form.is_published} onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))} />
            <span className="text-xs text-muted-foreground">Publié</span>
          </div>
          <Button size="sm" onClick={handleSave} className="gap-1.5"><Save size={14} /> {editing ? "Mettre à jour" : "Créer"}</Button>
          {editing && <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setForm({ slug: "", title: "", content: "", is_published: false }); }}><X size={14} /> Annuler</Button>}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{pages.length} page(s)</p>
      {pages.map((p) => (
        <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <FileText size={18} className="text-muted-foreground/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
            <p className="text-xs text-muted-foreground">/{p.slug} · {p.content.length} caractères</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.is_published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {p.is_published ? "Publié" : "Brouillon"}
            </span>
            <button onClick={() => handleToggle(p.id, p.is_published)} className={`p-1.5 rounded-md transition-colors ${p.is_published ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}>
              {p.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button onClick={() => { setEditing(p); setForm({ slug: p.slug, title: p.title, content: p.content, is_published: p.is_published }); }} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
              <Edit2 size={16} />
            </button>
            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-md text-destructive hover:bg-destructive/10">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
