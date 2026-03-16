import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Trash2, Eye, EyeOff, GripVertical, Save, X, Loader2, ChevronRight, Sparkles, PanelTop } from "lucide-react";

const MENU_GROUPS = [
  { value: "category_nav", label: "Barre catégories (Header)" },
  { value: "main", label: "Menu principal" },
  { value: "footer", label: "Footer" },
];

export default function MenusTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [activeGroup, setActiveGroup] = useState("category_nav");
  const [form, setForm] = useState({
    label: "",
    url: "/",
    is_visible: true,
    menu_group: "category_nav",
    parent_id: null as string | null,
    highlight: false,
    has_mega: false,
    icon: "",
    open_in_new_tab: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cms_menu_items")
      .select("*")
      .order("sort_order");
    setItems((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredItems = items.filter((i) => i.menu_group === activeGroup);
  const parentItems = filteredItems.filter((i) => !i.parent_id);
  const getChildren = (parentId: string) => filteredItems.filter((i) => i.parent_id === parentId);

  const resetForm = () => setForm({
    label: "", url: "/", is_visible: true, menu_group: activeGroup,
    parent_id: null, highlight: false, has_mega: false, icon: "", open_in_new_tab: false,
  });

  const handleSave = async () => {
    if (!form.label.trim()) return;
    const payload: any = {
      label: form.label,
      url: form.url,
      is_visible: form.is_visible,
      menu_group: form.menu_group,
      parent_id: form.parent_id || null,
      highlight: form.highlight,
      has_mega: form.has_mega,
      icon: form.icon || null,
      open_in_new_tab: form.open_in_new_tab,
    };
    if (editing) {
      await supabase.from("cms_menu_items").update(payload).eq("id", editing.id);
      toast({ title: "Menu mis à jour" });
    } else {
      await supabase.from("cms_menu_items").insert({ ...payload, sort_order: filteredItems.length });
      toast({ title: "Élément ajouté" });
    }
    setEditing(null);
    resetForm();
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

  const startEdit = (m: any) => {
    setEditing(m);
    setForm({
      label: m.label, url: m.url, is_visible: m.is_visible, menu_group: m.menu_group,
      parent_id: m.parent_id || null, highlight: m.highlight ?? false,
      has_mega: m.has_mega ?? false, icon: m.icon || "", open_in_new_tab: m.open_in_new_tab ?? false,
    });
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      {/* Group filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto">
        {MENU_GROUPS.map((g) => (
          <button
            key={g.value}
            onClick={() => { setActiveGroup(g.value); resetForm(); setEditing(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
              activeGroup === g.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary"
            }`}
          >
            {g.label}
            <span className="text-[10px] opacity-70">({items.filter((i) => i.menu_group === g.value).length})</span>
          </button>
        ))}
      </div>

      {/* Live preview for category_nav */}
      {activeGroup === "category_nav" && (
        <div className="bg-muted/30 border border-border rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <PanelTop size={14} className="text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Aperçu barre de navigation</span>
          </div>
          <div className="flex items-center gap-0 overflow-x-auto bg-card rounded-lg border border-border px-2">
            {parentItems.filter((i) => i.is_visible).map((link) => (
              <span
                key={link.id}
                className={`flex items-center gap-0.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap border-b-2 border-transparent ${
                  link.highlight ? "text-sale font-bold" : "text-foreground"
                } ${link.has_mega ? "font-bold" : ""}`}
              >
                {link.icon && <span className="mr-0.5">{link.icon}</span>}
                {link.label}
                {link.has_mega && <ChevronRight size={10} className="rotate-90 ml-0.5" />}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{editing ? "Modifier l'élément" : "Ajouter un élément"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Nouveautés" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="/category/shoes" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Groupe</Label>
            <Select value={form.menu_group} onValueChange={(v) => setForm((f) => ({ ...f, menu_group: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MENU_GROUPS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Parent (sous-menu)</Label>
            <Select value={form.parent_id || "_none"} onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v === "_none" ? null : v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Aucun (racine) —</SelectItem>
                {parentItems.filter((p) => p.id !== editing?.id).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Icône (emoji)</Label>
            <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="🔥" className="h-9 text-sm" />
          </div>
          <div className="flex items-center gap-3 pt-4">
            <Switch checked={form.highlight} onCheckedChange={(v) => setForm((f) => ({ ...f, highlight: v }))} />
            <Label className="text-xs flex items-center gap-1"><Sparkles size={12} className="text-sale" /> Highlight (Soldes)</Label>
          </div>
          <div className="flex items-center gap-3 pt-4">
            <Switch checked={form.has_mega} onCheckedChange={(v) => setForm((f) => ({ ...f, has_mega: v }))} />
            <Label className="text-xs">Mega-menu</Label>
          </div>
          <div className="flex items-center gap-3 pt-4">
            <Switch checked={form.open_in_new_tab} onCheckedChange={(v) => setForm((f) => ({ ...f, open_in_new_tab: v }))} />
            <Label className="text-xs">Ouvrir nouvel onglet</Label>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} className="gap-1.5"><Save size={14} /> {editing ? "Mettre à jour" : "Ajouter"}</Button>
          {editing && <Button size="sm" variant="ghost" onClick={() => { setEditing(null); resetForm(); }}><X size={14} /> Annuler</Button>}
        </div>
      </div>

      {/* Items list */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {MENU_GROUPS.find((g) => g.value === activeGroup)?.label} ({filteredItems.length})
        </h3>
        <div className="space-y-1">
          {parentItems.map((m) => {
            const children = getChildren(m.id);
            return (
              <div key={m.id}>
                <MenuItemRow item={m} onEdit={startEdit} onDelete={handleDelete} onToggle={handleToggle} />
                {children.length > 0 && (
                  <div className="ml-6 border-l-2 border-border/50 pl-2 space-y-1">
                    {children.map((child) => (
                      <MenuItemRow key={child.id} item={child} onEdit={startEdit} onDelete={handleDelete} onToggle={handleToggle} isChild />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filteredItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun élément dans ce groupe</p>}
        </div>
      </div>
    </div>
  );
}

function MenuItemRow({ item: m, onEdit, onDelete, onToggle, isChild }: {
  item: any; onEdit: (m: any) => void; onDelete: (id: string) => void; onToggle: (id: string, visible: boolean) => void; isChild?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${isChild ? "bg-muted/20" : "bg-muted/30"}`}>
      <GripVertical size={14} className="text-muted-foreground/40 cursor-grab shrink-0" />
      {m.icon && <span className="text-sm">{m.icon}</span>}
      <span className={`text-sm flex-1 ${m.highlight ? "text-sale font-bold" : "text-foreground"} ${!m.is_visible ? "opacity-40 line-through" : ""}`}>
        {m.label}
      </span>
      <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">{m.url}</span>
      {m.has_mega && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">MEGA</span>}
      {m.highlight && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sale/10 text-sale font-medium">PROMO</span>}
      <button onClick={() => onToggle(m.id, m.is_visible)} className={`p-1 rounded ${m.is_visible ? "text-primary" : "text-muted-foreground"}`}>
        {m.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button onClick={() => onEdit(m)} className="p-1 rounded text-muted-foreground hover:bg-muted">
        <Edit2 size={14} />
      </button>
      <button onClick={() => onDelete(m.id)} className="p-1 rounded text-destructive hover:bg-destructive/10">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
